import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const client = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION || 'us-east-1' })

// Use Amazon Nova Lite for cost-effective problem generation
const MODEL_ID = 'amazon.nova-lite-v1:0'

export interface BedrockResponse {
  content: string
}

export async function invokeNova(prompt: string): Promise<string> {
  const payload = {
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }]
      }
    ],
    inferenceConfig: {
      maxTokens: 2048,
      temperature: 0.9,
      topP: 0.95
    }
  }

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload)
  })

  const response = await client.send(command)
  const responseBody = JSON.parse(new TextDecoder().decode(response.body))

  return responseBody.output.message.content[0].text
}

export async function generateMathProblems(difficulty: string, count: number = 10, subcategories?: string[]) {
  const difficultyDescriptions = {
    elementary: 'elementary level (ages 6-10): basic addition, subtraction, simple multiplication and division, number patterns',
    middle: 'middle school level (ages 11-14): fractions, decimals, percentages, basic algebra, geometry concepts',
    high: 'high school level (ages 15-18): algebra, quadratic equations, geometry, trigonometry, advanced problem solving'
  }

  // Add randomness to ensure different problems each time
  const timestamp = Date.now()
  const randomSeed = Math.floor(Math.random() * 10000)

  // Build subcategory constraint if specified
  const subcategoryConstraint = subcategories && subcategories.length > 0
    ? `\n\nFOCUS ONLY ON THESE TOPICS: ${subcategories.join(', ')}\nGenerate problems ONLY from these specific topics. Do not include problems from other topics.`
    : ''

  const prompt = `Generate ${count} UNIQUE and VARIED math problems for ${difficultyDescriptions[difficulty as keyof typeof difficultyDescriptions]}.${subcategoryConstraint}

Session ID: ${timestamp}-${randomSeed}

IMPORTANT: Create completely different problems each time. Use different numbers, scenarios, and problem types.

For each problem, provide:
1. A clear, engaging question with different numbers and contexts
2. The correct answer
3. A topic/category
4. Maximum points (between 5-20 based on difficulty)

Format your response as a JSON array with this structure:
[
  {
    "question": "What is 15 + 27?",
    "correctAnswer": "42",
    "topic": "Addition",
    "maxPoints": 10
  }
]

Make the problems HIGHLY VARIED, engaging, and appropriate for the age group. Mix computational problems with word problems. Use different numbers, contexts, and scenarios in each problem.

IMPORTANT: Return ONLY the JSON array, no additional text or explanation.`

  const response = await invokeNova(prompt)

  // Extract JSON from response (in case there's additional text)
  const jsonMatch = response.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error('Failed to parse problem generation response')
  }

  return JSON.parse(jsonMatch[0])
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
