let calculateAngle = async (canvasContext, firstPoint, secondPoint, thirdPoint) => {

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
    const angle = Math.acos(dotProduct / (magnitudeAB * magnitudeBC));
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

export default calculateAngle