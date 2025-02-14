/**
 * Pose Detection Application
 * Using TensorFlow.js and Teachable Machine
 * Created: January 2024
 */

// Model URL from Teachable Machine
//**************************************************
//* as before, paste your link below
let URL = "https://teachablemachine.withgoogle.com/models/t594TCPs4/";

// Global variables
let model, webcam, ctx, labelContainer, maxPredictions;
let poseStates = {};  // Track states for each pose
let explosionActive = false;
let explosionSound = new Audio('explsn.mp3');

// Initialize the model URL
function setModelURL(url) {
    URL = url;
    poseStates = {};
    explosionActive = false;
}

/**
 * Initialize the application
 */
async function init() {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    const video = document.getElementById('instructionVideo');
    video.volume = 0.4;

    try {
        model = await tmPose.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();

        const width = 600;
        const height = 600;
        const flip = true;
        webcam = new tmPose.Webcam(width, height, flip);
        await webcam.setup();
        await webcam.play();
        window.requestAnimationFrame(loop);

        const canvas = document.getElementById("canvas");
        canvas.width = width;
        canvas.height = height;
        ctx = canvas.getContext("2d");
        labelContainer = document.getElementById("label-container");
        for (let i = 0; i < maxPredictions; i++) {
            labelContainer.appendChild(document.createElement("div"));
        }
    } catch (error) {
        console.error("Error initializing model:", error);
    }
}

async function loop(timestamp) {
    webcam.update();
    await predict();
    window.requestAnimationFrame(loop);
}

function playExplosionSound() {
    const newSound = new Audio('explsn.mp3');
    newSound.volume = 1.0;
    newSound.play();
}

async function predict() {
    try {
        const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
        const prediction = await model.predict(posenetOutput);
        const video = document.getElementById('instructionVideo');

        for (let i = 0; i < maxPredictions; i++) {
            const classPrediction =
                prediction[i].className + ": " + prediction[i].probability.toFixed(2);
            labelContainer.childNodes[i].innerHTML = classPrediction;

            // Check pose dynamically
            checkPose(prediction[i], video);
        }

        drawPose(pose, explosionActive);
    } catch (error) {
        console.error("Error in predict:", error);
    }
}

function checkPose(prediction, video) {
    const time = video.currentTime;
    const prob = prediction.probability;

    // Extract pose number
    const poseNumber = prediction.className.toLowerCase().replace(/[^0-9]/g, '');
    const isPoseLabel = prediction.className.toLowerCase().includes('pose') && poseNumber >= 1 && poseNumber <= 6;

    if (!isPoseLabel) return;

    if (!poseStates[`pose${poseNumber}`]) {
        poseStates[`pose${poseNumber}`] = {
            triggered: false
        };
    }

    const poseState = poseStates[`pose${poseNumber}`];

    // Define time windows for poses
    const poseTimeWindows = {
        '1': [22, 23],
        '2': [25, 26],
        '3': [33, 34],
        '4': [37, 38],
        '5': [42, 43],
        '6': [58, 59],
    };

    if (poseTimeWindows[poseNumber]) {
        const [startTime, endTime] = poseTimeWindows[poseNumber];

        // Reset pose state if outside its valid time window
        if (time < startTime || time > endTime) {
            poseState.triggered = false;
        }

        // Trigger explosion if within the time window and probability is high enough
        if (time >= startTime && time <= endTime && prob > 0.8 && !poseState.triggered && !explosionActive) {
            triggerExplosion(poseState);
        }
    }
}

function triggerExplosion(poseState) {
    explosionActive = true;
    poseState.triggered = true;
    playExplosionSound();
    setTimeout(() => { explosionActive = false; }, 300);
}

function drawPose(pose, explode) {
    if (webcam.canvas) {
        ctx.drawImage(webcam.canvas, 0, 0);
        if (pose) {
            const minPartConfidence = 0.5;
            if (explode) {
                pose.keypoints.forEach(keypoint => {
                    if (keypoint.score > minPartConfidence) {
                        const scale = 3;
                        ctx.beginPath();
                        ctx.arc(keypoint.position.x, keypoint.position.y, 10 * scale, 0, 2 * Math.PI);
                        ctx.fillStyle = '#FF0000';
                        ctx.fill();
                    }
                });
            } else {
                tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
                tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
            }
        }
    }
}

async function playInstructionVideo() {
    const video = document.getElementById('instructionVideo');
    const videoSrc = video.getAttribute('data-video-src') || 'vid.mp4';
    video.src = videoSrc;
    const videoContainer = video.parentElement;

    video.addEventListener('timeupdate', () => {
        const minutes = Math.floor(video.currentTime / 60);
        const seconds = Math.floor(video.currentTime % 60);
        document.getElementById('videoTime').textContent = 
            `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    });

    video.play();
}

function stopInstructionVideo() {
    const video = document.getElementById('instructionVideo');
    video.pause();
    video.currentTime = 0;
}

function stopWebcam() {
    if (webcam) {
        webcam.stop();
        const canvas = document.getElementById("canvas");
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}
