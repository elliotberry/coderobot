import {encode, decode} from 'gpt-3-encoder';

/**
 * Tokenizer that uses GPT-3's encoder.
 */
class GPT3Tokenizer {
    decode(tokens) {
        return decode(tokens);
    }

    encode(text) {
        return encode(text);
    }
}

export default GPT3Tokenizer;
