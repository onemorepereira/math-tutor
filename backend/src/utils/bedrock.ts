import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { reconcileVerifiedAnswers, type VerifiableProblem } from './answerVerification.js'

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

export async function invokeNova(
  prompt: string,
  temperature: number = 0.9,
  modelId: string = MODEL_ID,
  maxTokens: number = 2048
): Promise<string> {
  const payload = {
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }]
      }
    ],
    inferenceConfig: {
      maxTokens,
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

Solve every problem yourself before writing it down and make sure correctAnswer is exactly right — a wrong answer is worse than an easy problem. Keep each question self-contained and unambiguous.

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

/**
 * Independently re-solves every generated problem and drops the ones whose
 * answer does not survive the second opinion. Generation runs hot enough to
 * hallucinate ("1/10 of 30 = 21"), and shipping a wrong answer to a kid is
 * worse than shipping one problem fewer.
 */
export async function verifyProblemAnswers<T extends VerifiableProblem>(problems: T[]): Promise<T[]> {
  if (problems.length === 0) {
    return problems
  }

  const questionsForVerification = problems.map((p, i) => `${i + 1}. [ID: ${p.id}] ${p.question}`).join('\n')

  const prompt = `Solve each of the following math problems. These answers are graded against a student's work, so accuracy matters more than speed.

${questionsForVerification}

Work through each problem step by step — show your arithmetic so you can catch your own mistakes.

Then, on the last line only, output a JSON object mapping each ID to its final answer. Example:
{"id-1": "42", "id-2": "3/4"}

The JSON object must be the last thing you write, with no text after it.`

  console.log(`[verifyProblemAnswers] Verifying ${problems.length} problems using Nova 2 Lite`)
  debug(`[verifyProblemAnswers] Questions:`, JSON.stringify(problems.map(p => ({ id: p.id, question: p.question, originalAnswer: p.correctAnswer }))))

  try {
    // Reasoning needs room, and the answer JSON comes after it
    const response = await invokeNova(prompt, 0.2, VERIFICATION_MODEL_ID, 6000)
    debug(`[verifyProblemAnswers] Nova 2 Lite response:`, response)

    // The answer object is flat and comes last; a greedy match would swallow
    // any braces that appear in the worked solutions above it
    const jsonMatches = response.match(/\{[^{}]*\}/g)
    if (!jsonMatches || jsonMatches.length === 0) {
      console.warn(`[verifyProblemAnswers] Failed to parse JSON from response, keeping original problems`)
      return problems
    }

    const verifiedAnswers: Record<string, string> = JSON.parse(jsonMatches[jsonMatches.length - 1])
    debug(`[verifyProblemAnswers] Verified answers:`, JSON.stringify(verifiedAnswers))

    const { problems: kept, droppedIds } = reconcileVerifiedAnswers(problems, verifiedAnswers)

    if (droppedIds.length > 0) {
      const dropped = problems.filter(p => droppedIds.includes(p.id))
      console.warn(`[verifyProblemAnswers] Dropped ${droppedIds.length}/${problems.length} problems on answer disagreement: ${
        dropped.map(p => `"${p.question}" (generated ${p.correctAnswer}, verified ${verifiedAnswers[p.id]})`).join('; ')
      }`)
    }

    return kept
  } catch (error) {
    console.error(`[verifyProblemAnswers] Verification failed, keeping original problems:`, error)
    return problems
  }
}

export async function generateHint(
  question: string,
  correctAnswer: string,
  hintNumber: number,
  ageGroup: string
) {
  const prompt = `You are a math tutor giving hint #${hintNumber} to a ${ageGroup}-school student.

Question: ${question}
Correct Answer: ${correctAnswer}

${hintNumber === 1
    ? 'Name the first concrete step or rule that unlocks this problem, without doing it for them.'
    : 'Walk them up to the final step: state the rule AND set up the work, but stop before computing the answer.'
}

Rules for the hint:
- 1 to 2 short sentences, 35 words maximum
- Start with the math, not with praise — no "Great job", "You're on the right track", or "Keep going"
- Be concrete about THIS problem (name the actual numbers or the actual rule)
- Never state the final answer
- Plain language a student can read at a glance

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
