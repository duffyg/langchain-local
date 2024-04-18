export async function chat (openai, options) {
    const response = await openai.chat.completions.create({
        model: process.env.OPENAI_API_MODEL,
        messages: [
            {
                role: 'user',
                content: options.prompt
            }
        ],
        temperature: 1,
        max_tokens: 256,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stop: options.stop || []
    })
    const content = response.choices[0].message.content
    return content
}
