<script>
    // import './test.css';

    import {onMount} from 'svelte'
    import isHeadBent from "$lib/bend-head";
    import {calculateAngle, calculateNeckAngle, midPointCalculator, normalizeForCanvas} from "$lib/calculate-angle";
    import getSample from "$lib/sample-array-angle";
    import inverseNormalize from "$lib/inverse-normalize";
    import DynamicTimeWarping from "$lib/dtw.js";

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
        let rightShoulder = frame[mpPose['POSE_LANDMARKS']['RIGHT_SHOULDER']]
        let rightElbow = frame[mpPose['POSE_LANDMARKS']['RIGHT_ELBOW']]
        let rightWrist = frame[mpPose['POSE_LANDMARKS']['RIGHT_WRIST']]
        let leftShoulder = frame[mpPose['POSE_LANDMARKS']['LEFT_SHOULDER']]
        let leftElbow = frame[mpPose['POSE_LANDMARKS']['LEFT_ELBOW']]
        let leftWrist = frame[mpPose['POSE_LANDMARKS']['LEFT_WRIST']]
        let nose = frame[mpPose['POSE_LANDMARKS']['NOSE']]

        let leftElbowAngle = calculateAngle(canvasContext, leftShoulder, leftElbow, leftWrist, false)
        let rightElbowAngle = calculateAngle(canvasContext, rightShoulder, rightElbow, rightWrist, true)
        let neckAngle = calculateNeckAngle(canvasContext, nose, leftShoulder, rightShoulder);
        let leftShoulderAngle = calculateAngle(canvasContext, { x: leftShoulder.x, y: leftShoulder.y - 1 }, leftShoulder, leftWrist, false)
        let rightShoulderAngle = calculateAngle(canvasContext, { x: rightShoulder.x, y: rightShoulder.y - 1 }, rightShoulder, rightWrist, true)

        //todo nose.z

        // angle saving to memory =======================================
        angles.push({rightElbow: rightElbowAngle, leftElbow: leftElbowAngle, timestamp: Date.now()});
        // Remove the oldest angles if the array exceeds the time window
        while (angles.length > 0 && angles[0].timestamp < Date.now() - duration * 1000) {
            angles.shift();
        }
        if (recordedAngles.length === 0) { // return a high DWT distance if no recorded angles
            return;
        }
        // DWT distance =======================================
        let dwtDistance = await calculateDTWDistance();
        // convert dwt distance to %
        if (parseFloat(dwtDistance) < 1500) {
            let normalizedDwt = inverseNormalize(dwtDistance, 200, 1500)
            console.log(normalizedDwt)
        }
    }

    let calculateDTWDistance = async () => {
        const distFunc = (a, b) => Math.abs(a - b);
        let convertedAngles = await Promise.all(angles.map(function (item) {
            return item.rightElbow;
        }));
        let convertedRecordedAngles = await Promise.all(recordedAngles.map(function (item) {
            return item.rightElbow;
        }));
        const dtw = new DynamicTimeWarping(convertedRecordedAngles, convertedAngles, distFunc);
        const dist = dtw.getDistance();

        const elbowBlinker = document.getElementById('elbowBlinker');

        if (dist<1000) {
            // console.log(dist)
            elbowBlinker.classList.add('bg-green-500');
        } else{
            elbowBlinker.classList.remove('bg-green-500');
        }
        return dist;
    }

    let isRecording = false;
    let countdown = 6; // starting value of the countdown
    let triggerRecord = () => {
        if (!isRecording) {
            const interval = setInterval(() => {
                countdown -= 1;
                if (countdown === 0) {
                    clearInterval(interval);
                    // action after countdown ends
                    isRecording = true;
                    countdown = 6;
                    // showRecordingIndicator(true)
                    setTimeout(() => {
                        console.log('5 seconds have passed!');
                        // showRecordingIndicator(false)
                        recordedAngles = [...angles];
                        isRecording = false;
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
    let takeSnapshot = () => {
        // console.log(globalResult)
        let leftShoulder = globalFrame["12"]
        let leftElbow = globalFrame["14"]
        // console.log("localized", leftShoulder)
        // console.log("word", globalWorld["12"]["x"])

        isHeadBent(globalFrame)

        if (leftShoulder["x"] < 0) {
            console.log("shoulder outside view");
            return;
        }
        if (leftElbow["x"] < 0) {
            console.log("elbow outside view");
            return;
        }

        // console.log(leftShoulder["y"])
        // console.log(leftElbow["y"])
        if (leftElbow["y"] < leftShoulder["y"]) {
            console.log("elbow below shoulder");
            return;
        }


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

    // function updateProgressBar(progress) {
    //     const progressBar = document.getElementById('progressBar');
    //     progressBar.innerHTML = `
    //     <svg width="30%" height="30%" viewBox="0 0 42 42" class="donut">
    //         <circle class="donut-hole" cx="21" cy="21" r="15.91549430918954" fill="none"></circle>
    //         <circle class="donut-ring" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#d2d3d4" stroke-width="3"></circle>
    //         <circle class="donut-segment" cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#00a3e0" stroke-width="3" stroke-dasharray="${progress} ${100 - progress}" stroke-dashoffset="25"></circle>
    //     </svg>
    // `;
    // }
    let appstatus = "Recording";
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


<div class="container h-screen w-full">
    <video class="input_video hidden"></video>
    <div class="relative w-[1280px] h-[720px]">
        <canvas class="output_canvas" width="1280px" height="720px"></canvas>

        <!-- Recording indicator -->
        {#if isRecording}
            <div id="recordingIndicator" class="absolute top-10 left-0 w-full flex justify-center">
                <div class="blink animate-pulse">
                    <svg width="300" height="50" viewBox="0 0 200 50" xmlns="http://www.w3.org/2000/svg" class="mt-2">
                        <circle cx="20" cy="17" r="10" fill="red"/>
                        <text x="50" y="30" font-family="Arial" font-size="40" fill="red">{appstatus}</text>
                    </svg>
                </div>
            </div>
        {/if}


        {#if countdown < 6}
            <div id="readyUp" class="absolute top-10 left-0 w-full flex justify-center text-white text-6xl">
                ready up: {countdown}
            </div>
        {/if}

        <!-- Floating Side Panel -->
        <div class="absolute top-0 left-0 h-screen bg-transparent flex flex-col p-4 space-y-4">
            <!-- Contents of the panel -->
            {#if !isRecording && countdown === 6}
                <div>
                    <a href="/" on:click|preventDefault={triggerRecord}>
                        <div id="recordButton"
                             class="bg-red-500 hover:bg-red-700 text-white font-bold px-4 py-4 flex items-center justify-center rounded">
                            Record a new exercise
                        </div>
                    </a>
                </div>
            {/if}

            <div>
                <a href="/" on:click|preventDefault={triggerSnapshotAnalysis}>
                    <div class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                        Snapshot
                    </div>
                </a>
            </div>
<!--            <div class="flex-grow flex flex-col justify-center items-center">-->
<!--                <div id="elbowBlinker" class="flex items-center justify-center w-40 h-40 rounded-full">-->
<!--                    <img src="images/elbow.png" alt="Icon" class="w-20 h-20" />-->
<!--                </div>-->

<!--            </div>-->
            <!-- Spacer to push the bottom item to the end -->
            <div class="flex-grow"></div>

            <!-- Bottom item -->
<!--            <div class="mt-auto">-->
<!--                <div id="reccccc" class="flex items-center justify-center w-40 h-40 rounded-full">-->
<!--                    <img src="images/record.png" alt="Icon" class="w-20 h-20"/>-->
<!--                </div>-->
<!--            </div>-->
            <div class="mt-auto">
                <div id="neckBlinker" class="flex items-center justify-center w-40 h-40 rounded-full">
                    <img src="images/neck.png" alt="Icon" class="w-20 h-20"/>
                </div>
            </div>
            <div class="mt-auto">
                <div id="shoulderBlinker" class="flex items-center justify-center w-40 h-40 rounded-full">
                    <img src="images/shoulders.png" alt="Icon" class="w-20 h-20"/>
                </div>
            </div>
            <div class="mt-auto">
                <div id="elbowBlinker" class="flex items-center justify-center w-40 h-40 rounded-full">
                    <img src="images/elbow.png" alt="Icon" class="w-20 h-20" />
                </div>
            </div>
        </div>

    </div>
</div>


<!--<div id="progressBar" class="absolute top-0 left-0 w-full h-full flex items-center justify-center">-->
<!--    &lt;!&ndash; Progress bar content goes here &ndash;&gt;-->
<!--</div>-->

<div class="control-panel fixed left-0 top-0 h-screen w-1/6 bg-white hidden">
</div>
<div class="square-box fixed right-0 top-0 h-screen w-1/6 bg-white">
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
</style>