// Convert n-dimensional indices to flat index
function getFlatIndex(indices, shape) {
    let index = 0;
    let stride = 1;
    for (let i = shape.length - 1; i >= 0; i--) {
        if (indices[i] >= shape[i]) {
            throw new Error(`Index ${indices[i]} out of bounds for dimension ${i}`);
        }
        index += indices[i] * stride;
        stride *= shape[i];
    }
    return index;
}

// Usage examples:
const flatArray = [1, 2, 3, 4, 5, 6, 7, 8];
const shape = [2, 2, 2];  // 3D array

// Access like: array[1][0][1]
const value = flatArray[getFlatIndex([1, 0, 1], shape)];

// Or make it more convenient with a getter function:
function get(array, shape, ...indices) {
    return array[getFlatIndex(indices, shape)];
}

// Then use like:
console.log(get(flatArray, shape, 1, 0, 1));  // same as array[1][0][1]

// For setting values:
function set(array, shape, ...args) {
    const value = args[args.length - 1];
    const indices = args.slice(0, -1);
    array[getFlatIndex(indices, shape)] = value;
}

// Use like:
set(flatArray, shape, 1, 0, 1, 42);  // same as array[1][0][1] = 42