import {decode,encode} from 'gpt-tokenizer/model/gpt-4o';

class GPT3Tokenizer {
    decode(tokens) {
        return decode(tokens);
    }

    encode(text) {
        return encode(text);
    }
}

export default GPT3Tokenizer;
