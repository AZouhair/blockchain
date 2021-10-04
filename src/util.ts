import { LookUpTable } from "./interfaces";

export const getCurrentTimestamp = (): number => Math.round(new Date().getTime() / 1000);

export const hexToBinary = (s: string): string | null => {
    let ret: string = '';
    const lookupTable: LookUpTable = {
        '0': '0000', '1': '0001', '2': '0010', '3': '0011', '4': '0100',
        '5': '0101', '6': '0110', '7': '0111', '8': '1000', '9': '1001',
        'a': '1010', 'b': '1011', 'c': '1100', 'd': '1101',
        'e': '1110', 'f': '1111'
    };
    for (let i: number = 0; i < s.length; i = i + 1) {
        if (lookupTable[s[i]]) {
            ret += lookupTable[s[i]];
        } else {
            return null;
        }
    }
    return ret;
};

export const deepCopy = (inObject: any) => {
    let outObject:  {[key: string]: any} , value, key
  
    if (typeof inObject !== "object" || inObject === null) {
      return inObject // Return the value if inObject is not an object
    }
  
    // Create an array or object to hold the values
    outObject  = Array.isArray(inObject) ? [] : {}
  
    for (key in inObject) {
      value = inObject[key]
  
      // Recursively (deep) copy for nested objects, including arrays
      outObject[key] = deepCopy(value)
    }
  
    return outObject
  }

  export const toHexString = (byteArray: Iterable<any> | ArrayLike<any>): string => {
    return Array.from(byteArray, (byte: any) => {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
};
