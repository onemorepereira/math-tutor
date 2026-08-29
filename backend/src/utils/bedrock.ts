import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const client = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'us-east-1' })

// Amazon Nova 2 Lite handles both problem generation and answer verification.
// It is inference-profile only (no on-demand), so we invoke via the US cross-region
// inference profile (keeps inference within US regions).
const MODEL_ID = 'us.amazon.nova-2-lite-v1:0'
const VERIFICATION_MODEL_ID = 'us.amazon.nova-2-lite-v1:0'

// Verbose, per-problem logging is gated behind a flag to keep CloudWatch volume/cost down.
// Set DEBUG_BEDROCK=true on the function to see full prompts/responses.
const DEBUG = process.env.DEBUG_BEDROCK === 'true'
function debug(...args: unknown[]): void {
  if (DEBUG) console.log(...args)
}

export interface BedrockResponse {
  content: string
}

export async function invokeNova(prompt: string, temperature: number = 0.9, modelId: string = MODEL_ID): Promise<string> {
  const payload = {
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }]
      }
    ],
    inferenceConfig: {
      maxTokens: 2048,
      temperature,
      topP: 0.95
    }
  }

  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload)
  })

  const response = await client.send(command)
  const responseBody = JSON.parse(new TextDecoder().decode(response.body))

  // Return the first text content block. Nova 2 is a reasoning model; with extended
  // thinking enabled it can emit non-text (reasoning) blocks first, so don't assume
  // content[0] is the answer.
  const content = responseBody.output?.message?.content ?? []
  const textBlock = content.find((b: { text?: string }) => typeof b.text === 'string')
  if (!textBlock) {
    throw new Error('Bedrock response contained no text content')
  }
  return textBlock.text
}

export async function generateMathProblems(difficulty: string, count: number = 10, subcategories?: string[]) {
  const difficultyDescriptions = {
    elementary: 'elementary level (ages 6-10): basic addition, subtraction, simple multiplication and division, number patterns, and basic fractions (halves, thirds, quarters, identifying parts of a whole, simple fraction comparisons)',
    middle: 'middle school level (ages 11-14): fractions, decimals, percentages, basic algebra, geometry concepts',
    high: 'high school level (ages 15-18): algebra, quadratic equations, geometry, trigonometry, advanced problem solving'
  }

  // Add randomness to ensure different problems each time
  const timestamp = Date.now()
  const randomSeed = Math.floor(Math.random() * 10000)

  // Canonical topic labels per difficulty; keeps stats aggregation clean
  const canonicalTopics = {
    elementary: ['Addition', 'Subtraction', 'Multiplication', 'Division', 'Number Patterns', 'Fractions'],
    middle: ['Fractions', 'Decimals', 'Percentages', 'Basic Algebra', 'Geometry'],
    high: ['Algebra', 'Equations', 'Geometry', 'Trigonometry', 'Word Problems']
  }
  const topicChoices = (subcategories && subcategories.length > 0)
    ? subcategories
    : canonicalTopics[difficulty as keyof typeof canonicalTopics] ?? canonicalTopics.elementary

  // Build subcategory constraint if specified
  const subcategoryConstraint = subcategories && subcategories.length > 0
    ? `\n\nFOCUS ONLY ON THESE TOPICS: ${subcategories.join(', ')}\nGenerate problems ONLY from these specific topics. Do not include problems from other topics.`
    : ''

  // Note: the example below is intentionally a single compact inline object.
  // A multi-line/multi-object example caused Nova 2 Lite to return an empty array.
  const prompt = `Generate ${count} UNIQUE and VARIED math problems for ${difficultyDescriptions[difficulty as keyof typeof difficultyDescriptions]}.${subcategoryConstraint}

Session ID: ${timestamp}-${randomSeed}

Create completely different problems each time, using different numbers, scenarios, and problem types. Mix computational problems with word problems.

For each problem provide: a question, the correctAnswer, a topic, maxPoints (5-20 based on difficulty), and answerType ("numeric" if the answer is a number including decimals/negatives, "text" if it is a word or phrase).

The topic field MUST be exactly one of: ${topicChoices.join(', ')}. Do not invent other topic labels.

Format your response as a JSON array like:
[{"question":"What is 15 + 27?","correctAnswer":"42","topic":"Addition","maxPoints":10,"answerType":"numeric"}]

You MUST output all ${count} complete problems. Return ONLY the JSON array, no additional text or explanation.`

  const response = await invokeNova(prompt)

  // Extract JSON from response (Nova may wrap it in markdown code fences)
  const jsonMatch = response.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error('Failed to parse problem generation response')
  }

  const problems = JSON.parse(jsonMatch[0])
  if (!Array.isArray(problems) || problems.length === 0) {
    throw new Error('Problem generation returned no problems')
  }

  return problems
}

export async function verifyTextAnswers(
  problems: Array<{ id: string; question: string; correctAnswer: string; answerType: string }>
): Promise<Array<{ id: string; question: string; correctAnswer: string; answerType: string }>> {
  const textProblems = problems.filter(p => p.answerType === 'text')

  if (textProblems.length === 0) {
    return problems
  }

  const questionsForVerification = textProblems.map((p, i) => `${i + 1}. [ID: ${p.id}] ${p.question}`).join('\n')

  const prompt = `Solve each of the following problems. For each one, provide ONLY the answer — a single word or short phrase.

${questionsForVerification}

Return your answers as a JSON object mapping each ID to your answer. Example:
{"id-1": "answer1", "id-2": "answer2"}

IMPORTANT: Return ONLY the JSON object, no additional text.`

  console.log(`[verifyTextAnswers] Verifying ${textProblems.length} text-answer problems using Nova 2 Lite`)
  debug(`[verifyTextAnswers] Questions:`, JSON.stringify(textProblems.map(p => ({ id: p.id, question: p.question, originalAnswer: p.correctAnswer }))))

  try {
    const response = await invokeNova(prompt, 0.3, VERIFICATION_MODEL_ID)
    debug(`[verifyTextAnswers] Nova 2 Lite response:`, response)

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn(`[verifyTextAnswers] Failed to parse JSON from response, using original answers`)
      return problems
    }

    const verifiedAnswers: Record<string, string> = JSON.parse(jsonMatch[0])
    debug(`[verifyTextAnswers] Verified answers:`, JSON.stringify(verifiedAnswers))

    let mismatchCount = 0
    const result = problems.map(p => {
      if (p.answerType !== 'text') return p

      const verifiedAnswer = verifiedAnswers[p.id]
      if (!verifiedAnswer) {
        debug(`[verifyTextAnswers] No verified answer for problem ${p.id}, keeping original`)
        return p
      }

      const normalizedOriginal = p.correctAnswer.toLowerCase().trim()
      const normalizedVerified = verifiedAnswer.toLowerCase().trim()

      if (normalizedOriginal !== normalizedVerified) {
        mismatchCount++
        debug(`[verifyTextAnswers] MISMATCH for "${p.question}": original="${p.correctAnswer}" verified="${verifiedAnswer.trim()}" — using verified`)
        return { ...p, correctAnswer: verifiedAnswer.trim() }
      }

      return p
    })

    console.log(`[verifyTextAnswers] Corrected ${mismatchCount}/${textProblems.length} text answers`)
    return result
  } catch (error) {
    console.error(`[verifyTextAnswers] Verification failed, using original answers:`, error)
    return problems
  }
}

export async function generateHint(
  question: string,
  correctAnswer: string,
  hintNumber: number,
  ageGroup: string
) {
  const prompt = `You are a helpful math tutor. Generate hint #${hintNumber} for this problem:

Question: ${question}
Correct Answer: ${correctAnswer}
Student Age Group: ${ageGroup}

${hintNumber === 1
    ? 'Provide a gentle first hint that guides them toward the solution without giving it away.'
    : 'Provide a stronger second hint that gives more direction but still requires them to solve it.'
}

Keep the hint age-appropriate, encouraging, and under 100 words.

IMPORTANT: Return ONLY the hint text, no additional formatting or labels.`

  return await invokeNova(prompt)
}

export async function generateSolutionExplanation(
  question: string,
  correctAnswer: string,
  userAnswer: string,
  ageGroup: string
) {
  const prompt = `You are a patient math tutor explaining how to solve a problem.

Question: ${question}
Correct Answer: ${correctAnswer}
Student's Answer: ${userAnswer}
Student Age Group: ${ageGroup}

Provide:
1. A clear explanation of how to solve this problem
2. Step-by-step solution (3-5 steps)
3. An age-appropriate insight or tip to remember for similar problems

Format as JSON:
{
  "explanation": "overall explanation",
  "steps": ["step 1", "step 2", "step 3"],
  "ageAppropriateInsight": "encouraging insight"
}

Be encouraging, clear, and age-appropriate. Explain WHY we take each step, not just WHAT to do.

IMPORTANT: Return ONLY the JSON object, no additional text.`

  const response = await invokeNova(prompt)

  // Extract JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse explanation response')
  }

  return JSON.parse(jsonMatch[0])
}
