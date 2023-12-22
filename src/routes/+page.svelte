<script>
    import {onMount} from 'svelte'
    import {calculateAngle, calculateNeckAngle} from "$lib/calculate-angle";
    import inverseNormalize from "$lib/inverse-normalize";
    import DynamicTimeWarping from "$lib/dtw";

    let globalMpPose = null;
    let globalFrame = null;
    let globalResult = null;
    let globalPreviousTimestamp = 0;
    let globalFrameRate = 0;

    // -- angle related
    const frameRate = 30; // Example frame rate
    const duration = 2; // Duration in seconds
    const maxFrames = frameRate * duration;
    let angles = [];
    let recordedAngles = [];

    let analyzeFrame = async (mpPose, frame, canvasContext) => {
        let rightShoulder = frame[mpPose['POSE_LANDMARKS']['LEFT_SHOULDER']]
        let rightElbow = frame[mpPose['POSE_LANDMARKS']['LEFT_ELBOW']]
        let rightWrist = frame[mpPose['POSE_LANDMARKS']['LEFT_WRIST']]
        let leftShoulder = frame[mpPose['POSE_LANDMARKS']['RIGHT_SHOULDER']]
        let leftElbow = frame[mpPose['POSE_LANDMARKS']['RIGHT_ELBOW']]
        let leftWrist = frame[mpPose['POSE_LANDMARKS']['RIGHT_WRIST']]
        let nose = frame[mpPose['POSE_LANDMARKS']['NOSE']]

        let leftElbowAngle = calculateAngle(canvasContext, leftShoulder, leftElbow, leftWrist, true)
        let rightElbowAngle = calculateAngle(canvasContext, rightShoulder, rightElbow, rightWrist, false)
        let neckAngle = calculateNeckAngle(canvasContext, nose, leftShoulder, rightShoulder);
        let leftShoulderAngle = calculateAngle(canvasContext, {
            x: leftShoulder.x,
            y: leftShoulder.y - 1
        }, leftShoulder, leftWrist, true)
        let rightShoulderAngle = calculateAngle(canvasContext, {
            x: rightShoulder.x,
            y: rightShoulder.y - 1
        }, rightShoulder, rightWrist, false)

        //todo nose.z

        // angle saving to memory =======================================
        angles.push({
            rightElbow: rightElbowAngle,
            leftElbow: leftElbowAngle,
            neck: neckAngle,
            rightShoulder: rightShoulderAngle,
            leftShoulder: leftShoulderAngle,
            timestamp: Date.now()
        });
        // Remove the oldest angles if the array exceeds the time window
        while (angles.length > 0 && angles[0].timestamp < Date.now() - duration * 1000) {
            angles.shift();
        }
        if (recordedAngles.length === 0 || isRecording) { // return a high DWT distance if no recorded angles
            return;
        }
        // DWT distance =======================================
        await calculateDTW();
    }

    let calculateDTW = async () => {
        let distRightElbow = await getNormalizedDWTDistance(angles, recordedAngles, 'rightElbow')
        let distLeftElbow = await getNormalizedDWTDistance(angles, recordedAngles, 'leftElbow')
        let distNeck = await getNormalizedDWTDistance(angles, recordedAngles, 'neck')
        let distRightShoulder = await getNormalizedDWTDistance(angles, recordedAngles, 'rightShoulder')
        let distLeftShoulder = await getNormalizedDWTDistance(angles, recordedAngles, 'leftShoulder')

        handleReps([distRightElbow, distLeftElbow, distNeck, distRightShoulder, distLeftShoulder])
        handleBlinker(document.getElementById('rightElbowBlinker'), distRightElbow)
        handleBlinker(document.getElementById('leftElbowBlinker'), distLeftElbow)
        handleBlinker(document.getElementById('neckBlinker'), distNeck)
        handleBlinker(document.getElementById('rightShoulderBlinker'), distRightShoulder)
        handleBlinker(document.getElementById('leftShoulderBlinker'), distLeftShoulder)
    }

    function handleBlinker(blinker, distance) {
        if (distance > thresholdAccuracy) {
            blinker.classList.add('bg-green-400');
            blinker.classList.remove('bg-white');
        } else {
            blinker.classList.remove('bg-green-400');
            blinker.classList.add('bg-white');
        }
    }

    let thresholdAccuracy = 75;
    let lastRepIncrementTime = 0;
    let stopRecordTime = 0;
    function handleReps(allDistances) {
        if (lastRepIncrementTime > Date.now() - 2000) {
            return;
        }
        if (stopRecordTime > Date.now() - 2000) {
            return;
        }
        if (allDistances[0] > thresholdAccuracy && allDistances[1] > thresholdAccuracy && allDistances[2] > thresholdAccuracy && allDistances[3] > thresholdAccuracy && allDistances[4] > thresholdAccuracy) {
            reps += 1;
            lastRepIncrementTime = Date.now();
        }
    }

    let getNormalizedDWTDistance = async (liveAngles, recordedAngles, jointName) => {
        let convertedLiveAngles = await Promise.all(liveAngles.map(function (item) {
            return item[jointName];
        }))
        let convertedRecordedAngles = await Promise.all(recordedAngles.map(function (item) {
            return item[jointName];
        }))

        const dtw = new DynamicTimeWarping(convertedLiveAngles, convertedRecordedAngles, distFunc);
        const dist = dtw.getDistance();
        // convert dwt distance to %
        if (parseFloat(dist) < 1500) {
            let normalizedDwt = inverseNormalize(dist, 200, 1500)
            return (normalizedDwt)
        } else return 0
    }

    const distFunc = (a, b) => Math.abs(a - b);
    let isRecording = false;
    let reps = 0;
    let countdown = 5; // starting value of the ready up countdown
    let recordingCountdown = 5;

    let triggerRecord = () => {
        if (!isRecording) {
            reps = 0;
            const interval = setInterval(() => {
                countdown -= 1;
                if (countdown === 0) {
                    clearInterval(interval);
                    // action after countdown ends
                    isRecording = true;
                    countdown = 5;

                    // ==== the recording countdown
                    const interval2 = setInterval(() => {
                        recordingCountdown -= 1;
                        if (recordingCountdown === 0) {
                            clearInterval(interval2);
                            recordingCountdown = 5;
                        }
                    }, 1000);
                    //=========================================
                    // ==== wait for 5 seconds
                    setTimeout(() => {
                        console.log('5 seconds have passed!');
                        recordedAngles = [...angles];
                        isRecording = false;
                        stopRecordTime = Date.now();
                    }, 5000);
                }
            }, 1000);
        } else {
            // do nothing
        }
    }

    let triggerSnapshotAnalysis = async () => {
        // analyzeFrame(globalMpPose, globalFrame, globalCanvasContext);
    }

    let globalCanvasContext = null;

    onMount(async () => {

        const controls = window;
        const LandmarkGrid = window.LandmarkGrid;
        const drawingUtils = window;
        const mpPose = window;
        console.log("Running version: ", mpPose.VERSION)

        const options = {
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${mpPose.VERSION}/${file}`;
            }
        };
        // Our input frames will come from here.
        const videoElement = document.getElementsByClassName('input_video')[0];
        const canvasElement = document.getElementsByClassName('output_canvas')[0];
        const controlsElement = document.getElementsByClassName('control-panel')[0];
        const canvasCtx = canvasElement.getContext('2d');
        globalCanvasContext = canvasCtx;
        // We'll add this to our control panel later, but we'll save it here so we can
        // call tick() each time the graph runs.
        const fpsControl = new controls.FPS();
        // Optimization: Turn off animated spinner after its hiding animation is done.
        // const spinner = document.querySelector('.loading');
        // spinner.ontransitionend = () => {
        //     spinner.style.display = 'none';
        // };
        const landmarkContainer = document.getElementsByClassName('landmark-grid-container')[0];
        const grid = new LandmarkGrid(landmarkContainer, {
            connectionColor: 0xCCCCCC,
            definedColors: [{name: 'LEFT', value: 0xffa500}, {name: 'RIGHT', value: 0x00ffff}],
            range: 2,
            fitToGrid: true,
            labelSuffix: 'm',
            landmarkSize: 2,
            numCellsPerAxis: 4,
            showHidden: false,
            centered: true,
        });
        let activeEffect = 'mask';

        function onResults(results) {

            globalMpPose = mpPose;
            globalFrame = results["poseLandmarks"];
            const currentTimestamp = performance.now();
            if (globalPreviousTimestamp !== 0) {
                const timeDifference = currentTimestamp - globalPreviousTimestamp; // Time difference in milliseconds
                // Calculating frames per second
                globalFrameRate = 1000 / timeDifference;
            }
            globalPreviousTimestamp = currentTimestamp;


            // globalWorld = results["poseWorldLandmarks"];

            // Hide the spinner.
            // console.log("localized", results)
            // console.log("localized", results["poseLandmarks"]["12"])
            // console.log("word", results["poseWorldLandmarks"]["12"])
            document.body.classList.add('loaded');
            // Update the frame rate.
            fpsControl.tick();
            // Draw the overlays.
            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            if (results.segmentationMask) {
                canvasCtx.drawImage(results.segmentationMask, 0, 0, canvasElement.width, canvasElement.height);
                // Only overwrite existing pixels.
                if (activeEffect === 'mask' || activeEffect === 'both') {
                    canvasCtx.globalCompositeOperation = 'source-in';
                    // This can be a color or a texture or whatever...
                    canvasCtx.fillStyle = '#00FF007F';
                    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
                } else {
                    canvasCtx.globalCompositeOperation = 'source-out';
                    canvasCtx.fillStyle = '#0000FF7F';
                    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
                }
                // Only overwrite missing pixels.
                canvasCtx.globalCompositeOperation = 'destination-atop';
                canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
                canvasCtx.globalCompositeOperation = 'source-over';
            } else {
                canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
            }
            if (results.poseLandmarks) {
                analyzeFrame(mpPose, results["poseLandmarks"], canvasCtx)

                drawingUtils.drawConnectors(canvasCtx, results.poseLandmarks, mpPose.POSE_CONNECTIONS, {
                    visibilityMin: 0.65,
                    color: 'white'
                });
                drawingUtils.drawLandmarks(canvasCtx, Object.values(mpPose.POSE_LANDMARKS_LEFT)
                    .map(index => results.poseLandmarks[index]), {
                    visibilityMin: 0.65,
                    color: 'white',
                    fillColor: 'rgb(255,138,0)'
                });
                drawingUtils.drawLandmarks(canvasCtx, Object.values(mpPose.POSE_LANDMARKS_RIGHT)
                    .map(index => results.poseLandmarks[index]), {
                    visibilityMin: 0.65,
                    color: 'white',
                    fillColor: 'rgb(0,217,231)'
                });
                drawingUtils.drawLandmarks(canvasCtx, Object.values(mpPose.POSE_LANDMARKS_NEUTRAL)
                    .map(index => results.poseLandmarks[index]), {
                    visibilityMin: 0.65,
                    color: 'white',
                    fillColor: 'white'
                });
            }
            canvasCtx.restore();
            if (results.poseWorldLandmarks) {
                grid.updateLandmarks(results.poseWorldLandmarks, mpPose.POSE_CONNECTIONS, [
                    {list: Object.values(mpPose.POSE_LANDMARKS_LEFT), color: 'LEFT'},
                    {list: Object.values(mpPose.POSE_LANDMARKS_RIGHT), color: 'RIGHT'},
                ]);
            } else {
                grid.updateLandmarks([]);
            }
        }

        const pose = new mpPose.Pose(options);
        pose.onResults(onResults);

        //todo controls here
        new controls
            .ControlPanel(controlsElement, {
                selfieMode: true,
                modelComplexity: 1,
                smoothLandmarks: true,
                enableSegmentation: false,
                smoothSegmentation: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
                effect: 'background',
            })
            .add([
                new controls.StaticText({title: 'Poserr for Vivira'}),
                fpsControl,
                new controls.Toggle({title: 'Selfie Mode', field: 'selfieMode'}),
                new controls.SourcePicker({
                    onSourceChanged: () => {
                        // Resets because this model gives better results when reset between
                        // source changes.
                        pose.reset();
                    },
                    onFrame: async (input, size) => {
                        const aspect = size.height / size.width;
                        let width, height;
                        if (window.innerWidth > window.innerHeight) {
                            height = window.innerHeight;
                            width = height / aspect;
                        } else {
                            width = window.innerWidth;
                            height = width * aspect;
                        }
                        canvasElement.width = width;
                        canvasElement.height = height;
                        await pose.send({image: input});
                    },
                }),
                new controls.Slider({
                    title: 'Model Complexity',
                    field: 'modelComplexity',
                    discrete: ['Lite', 'Full', 'Heavy'],
                }),
                new controls.Toggle({title: 'Smooth Landmarks', field: 'smoothLandmarks'}),
                new controls.Toggle({title: 'Enable Segmentation', field: 'enableSegmentation'}),
                new controls.Toggle({title: 'Smooth Segmentation', field: 'smoothSegmentation'}),
                new controls.Slider({
                    title: 'Min Detection Confidence',
                    field: 'minDetectionConfidence',
                    range: [0, 1],
                    step: 0.01
                }),
                new controls.Slider({
                    title: 'Min Tracking Confidence',
                    field: 'minTrackingConfidence',
                    range: [0, 1],
                    step: 0.01
                }),
                new controls.Slider({
                    title: 'Effect',
                    field: 'effect',
                    discrete: {'background': 'Background', 'mask': 'Foreground'},
                }),
            ])
            .on(x => {
                const options = x;
                videoElement.classList.toggle('selfie', options.selfieMode);
                activeEffect = x['effect'];
                pose.setOptions(options);
            });

    })


    // Usage: testSupport({client?: string, os?: string}[])
    // Client and os are regular expressions.
    // See: https://cdn.jsdelivr.net/npm/device-detector-js@2.2.10/README.md for
    // legal values for client and os

    // todo fix device detection below
    // testSupport([
    //     {client: 'Chrome'},
    // ]);

    // function testSupport(supportedDevices) {
    //     const deviceDetector = new DeviceDetector();
    //     const detectedDevice = deviceDetector.parse(navigator.userAgent);
    //     let isSupported = false;
    //     for (const device of supportedDevices) {
    //         if (device.client !== undefined) {
    //             const re = new RegExp(`^${device.client}$`);
    //             if (!re.test(detectedDevice.client.name)) {
    //                 continue;
    //             }
    //         }
    //         if (device.os !== undefined) {
    //             const re = new RegExp(`^${device.os}$`);
    //             if (!re.test(detectedDevice.os.name)) {
    //                 continue;
    //             }
    //         }
    //         isSupported = true;
    //         break;
    //     }
    //     if (!isSupported) {
    //         alert(`This demo, running on ${detectedDevice.client.name}/${detectedDevice.os.name}, ` +
    //             `is not well supported at this time, expect some flakiness while we improve our code.`);
    //     }
    // }

</script>


<svelte:head>
    <script src="https://cdn.skypack.dev/device-detector-js@2.2.10"></script>
    <link rel="stylesheet" type="text/css"
          href="https://cdn.jsdelivr.net/npm/@mediapipe/control_utils_3d@0.2/landmark_grid.css" crossorigin="anonymous">
    <link rel="stylesheet" type="text/css"
          href="https://cdn.jsdelivr.net/npm/@mediapipe/control_utils@0.6/control_utils.css" crossorigin="anonymous">
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js" crossorigin="anonymous">
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/control_utils_3d@0.2/control_utils_3d.js"
            crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/control_utils@0.6/control_utils.js" crossorigin="anonymous">
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3/drawing_utils.js" crossorigin="anonymous">
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.4/pose.js" crossorigin="anonymous"></script>
</svelte:head>

<div class="container h-screen w-full flex bg-black">
    <div class="w-1/4 bg-black flex flex-col items-center justify-center relative">
        {#if !isRecording && countdown === 5}
            <div class="absolute top-0 left-1/2 transform -translate-x-1/2 z-10 mt-10">
                <a href="/src/public" on:click|preventDefault={triggerRecord}>
                    <div id="recordButton"
                         class="bg-red-500 hover:bg-red-700 text-white font-bold w-20 h-20 flex items-center justify-center rounded-full">
                        <span class="text-lg">Record</span>
                    </div>
                </a>
            </div>
        {/if}

        <div id="neckBlinker" class="flex flex-col items-center justify-center bg-white w-40 h-40 rounded-full">
            <img src="images/neck.png" alt="Icon" class="w-20 h-20"/>
            <span class="text-center text-sm font-medium mt-5">Neck</span>
        </div>
        <div id="leftShoulderBlinker" class="flex flex-col items-center justify-center bg-white w-40 h-40 rounded-full">
            <img src="images/shoulders.png" alt="Icon" class="w-20 h-20"/>
            <span class="text-center text-sm font-medium mt-5">Left Shoulder</span>
        </div>
        <div id="leftElbowBlinker" class="flex flex-col items-center justify-center bg-white w-40 h-40 rounded-full">
            <img src="images/elbow.png" alt="Icon" class="w-20 h-20"/>
            <span class="text-center text-sm font-medium mt-5">Left Elbow</span>
        </div>
    </div>


    <div class="flex-grow relative">
    <video class="input_video hidden"></video>
        <canvas class="output_canvas" width="1280px" height="720px"></canvas>
        <!-- Recording indicator -->
        {#if isRecording}
            <div id="recordingIndicator" class="absolute top-10 left-0 w-full flex justify-center">
                <div class="blink animate-pulse">
                    <svg width="500" height="50" viewBox="0 0 200 50" xmlns="http://www.w3.org/2000/svg" class="mt-2">
                        <circle cx="20" cy="17" r="10" fill="red"/>
                        <text x="50" y="30" font-family="Arial" font-size="40" fill="red">Recording ({recordingCountdown})</text>
                    </svg>
                </div>
            </div>
        {/if}

        {#if countdown < 5}
            <div id="readyUp" class="absolute top-10 left-0 w-full flex justify-center text-white text-6xl">
                Get ready... ({countdown})
            </div>
        {/if}
    </div>


    <!-- Right white panel -->
    <div class="w-1/4 bg-black flex flex-col items-center justify-center">
        <div class="w-1/4 bg-black flex flex-col items-center justify-center space-y-6">

            <div class="absolute top-0  transform z-10 mt-10">
                <a href="/src/public" on:click|preventDefault>
                    <div class="bg-blue-500 text-white font-bold w-32 h-32 flex items-center justify-center rounded-full">
                        <span class="text-2xl">Reps: {reps}</span>
                    </div>
                </a>
            </div>

            <div id="rightShoulderBlinker" class="flex flex-col items-center justify-center bg-white w-40 h-40 rounded-full">
                <img src="images/shoulders.png" alt="Icon" class="w-20 h-20 scale-x-[-1]"/>
                <span class="text-center text-sm font-medium mt-5">Right Shoulder</span>
            </div>
            <div id="rightElbowBlinker" class="flex flex-col items-center justify-center bg-white w-40 h-40 rounded-full">
                <img src="images/elbow.png" alt="Icon" class="w-20 h-20 scale-x-[-1]"/>
                <span class="text-center text-sm font-medium mt-5">Right Elbow</span>
            </div>
        </div>
    </div>
</div>


<!--<div id="progressBar" class="absolute top-0 left-0 w-full h-full flex items-center justify-center">-->
<!--    &lt;!&ndash; Progress bar content goes here &ndash;&gt;-->
<!--</div>-->

<div class="control-panel fixed left-0 top-0 h-screen w-1/6 bg-white hidden">
</div>
<div class="square-box fixed right-0 top-0 h-screen w-1/6 bg-white hidden">
    <div class="landmark-grid-container">
    </div>
</div>


<style>
    .square-box {
        width: 33%;
        height: 0;
        padding-top: 33%;
        position: absolute;
        right: 20px;
        top: 20px;
    }

    .landmark-grid-container {
        height: 100%;
        width: 100%;
        position: absolute;
        top: 0;
        left: 0;
        background-color: #99999999;
    }

     :global(body) {
         background-color: black;
     }
</style>