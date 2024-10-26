class ItemSelector {
  /**
   * Returns the similarity between two vectors using the cosine similarity.
   * @param vector1 Vector 1
   * @param vector2 Vector 2
   * @returns Similarity between the two vectors
   */
  static cosineSimilarity(vector1, vector2) {
    const dotProduct = this.dotProduct(vector1, vector2)
    const norm1 = this.normalize(vector1)
    const norm2 = this.normalize(vector2)
    return dotProduct / (norm1 * norm2)
  }

  /**
   * Normalizes a vector.
   * @remarks
   * The norm of a vector is the square root of the sum of the squares of the elements.
   * The LocalIndex pre-normalizes all vectors to improve performance.
   * @param vector Vector to normalize
   * @returns Normalized vector
   */
  static normalize(vector) {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
  }

  /**
   * Returns the similarity between two vectors using cosine similarity.
   * @remarks
   * The LocalIndex pre-normalizes all vectors to improve performance.
   * This method uses the pre-calculated norms to improve performance.
   * @param vector1 Vector 1
   * @param norm1 Norm of vector 1
   * @param vector2 Vector 2
   * @param norm2 Norm of vector 2
   * @returns Similarity between the two vectors
   */
  static normalizedCosineSimilarity(vector1, norm1, vector2, norm2) {
    const dotProduct = this.dotProduct(vector1, vector2)
    return dotProduct / (norm1 * norm2)
  }

  /**
   * Applies a filter to the metadata of an item.
   * @param metadata Metadata of the item
   * @param filter Filter to apply
   * @returns True if the item matches the filter, false otherwise
   */
  static select(metadata, filter) {
    return Object.entries(filter).every(
      ([key, value]) => metadata[key] === value
    )
  }

  static dotProduct(vector1, vector2) {
    return vector1.reduce((sum, val, i) => sum + val * vector2[i], 0)
  }
}
export default ItemSelector