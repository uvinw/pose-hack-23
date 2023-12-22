export let calculateAngle = async (canvasContext, firstPoint, secondPoint, thirdPoint, isClockwise) => {

    // let firstPoint = frame[mpPose['POSE_LANDMARKS']['RIGHT_SHOULDER']]
    // let secondPoint = frame[mpPose['POSE_LANDMARKS']['RIGHT_ELBOW']]
    // let thirdPoint = frame[mpPose['POSE_LANDMARKS']['RIGHT_WRIST']]

    const vectorAB = {x: secondPoint.x - firstPoint.x, y: secondPoint.y - firstPoint.y};
    const vectorBC = {x: thirdPoint.x - secondPoint.x, y: thirdPoint.y - secondPoint.y};
    // Calculate the dot product of AB & BC
    const dotProduct = vectorAB.x * vectorBC.x + vectorAB.y * vectorBC.y;
    // Calculate the magnitude of AB & BC
    const magnitudeAB = Math.sqrt(vectorAB.x * vectorAB.x + vectorAB.y * vectorAB.y);
    const magnitudeBC = Math.sqrt(vectorBC.x * vectorBC.x + vectorBC.y * vectorBC.y);
    // Calculate the angle in radians
    let angle = Math.acos(dotProduct / (magnitudeAB * magnitudeBC));

    // Use the cross product to adjust the angle for >180 degrees
    const crossProduct = vectorAB.x * vectorBC.y - vectorAB.y * vectorBC.x;
    if (isClockwise) {
        if (crossProduct < 0) {
            angle = 2 * Math.PI - angle;
        }
    } else {
        if (crossProduct > 0) {
            angle = 2 * Math.PI - angle;
        }
    }


    // Convert radians to degrees
    let degreeAngle = angle * (180 / Math.PI)
    degreeAngle = Number(degreeAngle.toFixed(2));

    // Print the angle on the canvas
    canvasContext.font = "20px Arial";
    canvasContext.fillStyle = "white";
    canvasContext.strokeStyle = "white";
    canvasContext.lineWidth = 3;
    const elbowCanvasX = secondPoint.x * canvasContext.canvas.width + 20;
    const elbowCanvasY = secondPoint.y * canvasContext.canvas.height - 20;
    canvasContext.fillText(Number(degreeAngle.toFixed(0)) + "°", elbowCanvasX, elbowCanvasY);

    return degreeAngle
}

export let midPointCalculator = (firstPoint, secondPoint) => {
    return {
        x: ((firstPoint.x + secondPoint.x) / 2),
        y: ((firstPoint.y + secondPoint.y) / 2)
    }
}
export let calculateNeckAngle = async (canvasContext, nose, leftShoulder, rightShoulder) => {

    let midShoulder = midPointCalculator(leftShoulder, rightShoulder)

    let convertedNoseX = nose.x * canvasContext.canvas.width;
    let convertedNoseY = nose.y * canvasContext.canvas.height;

    let normalizedMidShoulder = normalizeForCanvas(canvasContext, midShoulder)

    console.log(midShoulder)
    canvasContext.fillStyle = "white";
    canvasContext.strokeStyle = "white";
    canvasContext.lineWidth = 3;
    canvasContext.beginPath();
    canvasContext.moveTo(convertedNoseX, convertedNoseY);
    canvasContext.lineTo(normalizedMidShoulder.x, normalizedMidShoulder.y);
    canvasContext.stroke();

    return calculateAngle(canvasContext, rightShoulder, midShoulder, nose)
}

export let normalizeForCanvas = (canvasContext, point) => {
    return {
        x: point.x * canvasContext.canvas.width,
        y: point.y * canvasContext.canvas.height
    }
}