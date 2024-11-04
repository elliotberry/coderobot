import {encode, decode} from 'gpt-tokenizer/model/gpt-4o';

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
