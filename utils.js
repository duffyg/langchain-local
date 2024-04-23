export const chunkArray = (arr, chunkSize) => arr.reduce((chunks, elem, index) => {
    const chunkIndex = Math.floor(index / chunkSize)
    const chunk = chunks[chunkIndex] || []
    chunks[chunkIndex] = chunk.concat([elem])
    return chunks
}, [])
