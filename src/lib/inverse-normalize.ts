let inverseNormalize = async (value, min, max) => {

    let numericValue = Number(value);

    if (numericValue < min) {
        return 100;
    } else if (numericValue > max) {
        return 0;
    }
    return 100 - ((numericValue - min) / (max - min) * 100);
}

export default inverseNormalize