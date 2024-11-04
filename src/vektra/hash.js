import pkg from "xxhash-addon"
const { XXHash3 } = pkg

const hashString = async (string_) => {
  const xxh3 = new XXHash3(Buffer.from([0, 0, 0, 0]))
  xxh3.update(string_)
  return xxh3.digest().toString("hex")
}
export default hashString