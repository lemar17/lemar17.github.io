// document.getElementById('transcript-input').addEventListener('input', updateStatistics);
let globalaudio = null;
document.getElementById('transcript-input').addEventListener('input', () => {
    updateStatistics()
    console.log("this happened")
  });
  
  function updateStatistics() {
  
    const transcript = document.getElementById('transcript-input').value;
  
    const wordCount = transcript.trim().split(/\s+/).length;
    document.getElementById('word-count').textContent = wordCount + "]";
    
    const audiofile = document.getElementById('audio-file').files[0];
    if (audiofile) {
        calcwpm(audiofile, wordCount);
    }

  }
  
  
  document.getElementById('clear-btn').addEventListener('click', () => {
    document.getElementById('transcript-input').value = '';
    updateStatistics();
  });
  
  document.getElementById('copy-btn').addEventListener('click', () => {
    const transcript = document.getElementById('transcript-input');
    transcript.select();
    document.execCommand('copy');
  });
  
  document.getElementById('download-btn').addEventListener('click', () => {
    const text = document.getElementById('transcript-input').value;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'transcript.txt';
    link.click();
    URL.revokeObjectURL(url);
  });
  
  document.getElementById("upload-button").addEventListener("click", function() {
    document.getElementById("audio-file").click();
  });
  
  document.getElementById("audio-file").addEventListener("change", function() {
    
    if (document.getElementById("audio-file").files.length > 0) {
        document.getElementById("current-file").textContent = "File Selected: " + document.getElementById("audio-file").files[0].name;
        
    }
  });
  
  
  let audioplayer = null;
  document.getElementById("play-audio").addEventListener("click", function() {
    const audiofile = document.getElementById("audio-file").files[0]
    if (!audiofile) {
        alert("select an audio file first")
        return;
    }
    if (audioplayer) {
        audioplayer.pause();
        audioplayer = null;
    }
    audioplayer = new Audio(URL.createObjectURL(audiofile));
    audioplayer.play();
    audioplayer.addEventListener("ended", () => {
        audioplayer = null;
    });
  });
  
  document.getElementById("pause-audio").addEventListener("click", function() {
    const audiofile = document.getElementById("audio-file").files[0]
    if (!audiofile) {
        alert("select an audio first.")
        return;
    }
    if (audioplayer.paused) {
        if (!audiofile) {
            alert("audio has been stopped, play again.")
            return;
        }
        audioplayer.play()
        document.getElementById("pause-audio").textContent = "Pause Audio"
    }
    else {
        audioplayer.pause()
        document.getElementById("pause-audio").textContent = "Resume Audio"
    }
  
  });
  
  async function calcwpm(audiofile, wordCount) {
    if (!audiofile) {
        document.getElementById('wpm').textContent = '0]';
        return;
    }
    if (globalaudio) {
        globalaudio.pause();
        globalaudio = null;
    }
    const audioURL = URL.createObjectURL(audiofile);
    globalaudio = new Audio();

    globalaudio.addEventListener('loadedmetadata', () => {
        if (!isFinite(globalaudio.duration) || globalaudio.duration === 0) {
            document.getElementById('wpm').textContent = 'Error]';
            document.getElementById('duration').textContent = 'Error]';
            return;
        }

        const durationsec = globalaudio.duration;
        const durationmin = durationsec / 60;
        const wpm = Math.round(wordCount / durationmin);

        document.getElementById('duration').textContent = durationsec.toFixed(2) + " seconds]";
        document.getElementById('wpm').textContent = wpm + "]";
    });
    
    globalaudio.addEventListener('error', () => {
        document.getElementById('wpm').textContent = 'Error]';
        document.getElementById('duration').textContent = 'Error]';
    });

    globalaudio.src = audioURL;

    
  }   

  //start rec
  let mediaRecorder = null;
  let socket = null;
  let recordingStream = null;
  let isRecording = false;
  
  document.getElementById('live-recording').addEventListener('click', () => {
    if (isRecording) {
        stopLiveRecording();
    }
    else{
        startLiveRecording();
    }
  });
  
  async function startLiveRecording() {
    try {
        recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
            alert('Browser not supported for audio/webm recording');
            return;
        }
  
        mediaRecorder = new MediaRecorder(recordingStream, { mimeType: 'audio/webm' });
  
        // Open WebSocket to Deepgram API for live transcription
        const socket = new WebSocket('wss://api.deepgram.com/v1/listen', [
            'token',
            '7902c5cc1a76c252b7381d2ce059a9fbbb972889',
          ]);
  
        socket.onopen = () => {
            // document.querySelector('#status').textContent = 'Connected';
            console.log('WebSocket connected');
            isRecording = true;
            document.getElementById('live-recording').textContent = "Stop [00:00]";
  
            // Send audio data to Deepgram when available
            mediaRecorder.addEventListener('dataavailable', (event) => {
                if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                    socket.send(event.data);
                }
            });
  
            // Start recording audio in chunks of 250ms
            mediaRecorder.start(250);
        };
  
        // Handle WebSocket message (received transcript)
        socket.onmessage = (message) => {
            const received = JSON.parse(message.data);
            const transcript = received.channel.alternatives[0].transcript;
  
            if (transcript && received.is_final) {
                console.log(transcript);
                // Append the live transcription to the textarea
                document.getElementById('transcript-input').value += transcript + ' ';
                updateStatistics();  // Update word count, filler word count, etc.
            }
        };
  
        socket.onclose = () => {
            console.log('WebSocket connection closed');
        };
  
        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
  
    } catch (error) {
        console.error('Error accessing microphone or starting live transcription:', error);
        alert('Failed to start live transcription. Please check your microphone permissions.');
    }
  }
  
  function stopLiveRecording() {
    if (isRecording) {
        // Stop the MediaRecorder
        mediaRecorder.stop();
        // Close the WebSocket connection
        if (socket) {
            socket.close();
        }
  
        // Stop the audio stream
        if (recordingStream) {
            recordingStream.getTracks().forEach(track => track.stop());
        }
  
        // Update the UI and button state
        isRecording = false;
        document.getElementById('live-recording').textContent = "Live [00:00]";
        // document.querySelector('#status').textContent = 'Disconnected';
        console.log('Recording stopped');
    }
  }
    

  // pressing space for the pause/unpause button
  document.addEventListener('keydown', function (event) {
    const audiofile = document.getElementById("audio-file").files[0];
    if (event.code === 'Space') {
        event.preventDefault();
        if (!audiofile) {
            alert("select an audio first.")
            return;
        }
        if (audioplayer.paused) {
            if (!audiofile) {
                alert("audio has been stopped, play again.")
                return;
            }
            audioplayer.play()
            document.getElementById("pause-audio").textContent = "Pause Audio"
        }
        else {
            audioplayer.pause()
            document.getElementById("pause-audio").textContent = "Resume Audio"
        }
    }
    else if (event.code === 'Enter') {
        event.preventDefault();
        document.getElementById("processing").click();
    }
  });
  
  
  
  document.getElementById("stop-audio").addEventListener("click", function() {
    const audiofile = document.getElementById("audio-file").files[0]
    if (!audiofile) {
        alert("select an audio first.")
    }
    if (audioplayer) {
        audioplayer.pause()
        audioplayer = null;
        document.getElementById("pause-audio").textContent = "Pause Audio"
    }
  
  });

  
  //transcription button (main feature)
  document.getElementById('processing').addEventListener('click', async () => {
    const audioFile = document.getElementById('audio-file').files[0];
    if (!audioFile) {
        alert('Please select an audio file first.');
        return;
    }
  
    const transcribingGui = document.getElementById('transcribing-gui');
    const transcribingTimer = document.getElementById('transcribing-timer');
    let seconds = 0;
  
    transcribingGui.style.display = 'block';
    const timerInterval = setInterval(() => {
        seconds += 1;
        transcribingTimer.textContent = seconds;
    }, 1000);
  
    const formData = new FormData();
    formData.append('audio', audioFile);
  
    try {
        const response = await fetch('http://127.0.0.1:5000/process-audio', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            document.getElementById('transcript-input').value = data.transcript.replace(/\\n/g, '');
            document.getElementById('confidence').textContent = data.confidence + "] (~" + (data.confidence * 100).toFixed(2) + '%)';
            document.getElementById('speakers').textContent = data.speakers + "]"
            document.getElementById('feedback-info').textContent = data.feedback

            document.getElementById('filler-words').textContent = data.fillercount + "]"
            
            const transcript = document.getElementById('transcript-input').value;
            const wordCount = transcript.trim().split(/\s+/).length;
            let dens = (data.fillercount/wordCount).toFixed(3);
            densInt = parseFloat(dens);
            document.getElementById('density').textContent = densInt*100+ "%]";

            document.getElementById('fillerdict').textContent = JSON.stringify(data.fillers)
            const formattedFillers = Object.entries(data.fillers)
                .map(([word, count]) => `"${word}": ${count}`)
                .join('<br>');
            document.getElementById('fillerdict').innerHTML = `<br>${formattedFillers}`;

            updateStatistics()

        } else {
            console.error('Server error:', response.statusText);
            alert('error happened in server');
        }
    } catch (error) {
        console.error('Fetch error:', error);
        alert('connection to server failed');
    } finally {
        clearInterval(timerInterval);
        transcribingGui.style.display = 'none';
        seconds = 0
        transcribingTimer.textContent = seconds;
    }
    
  });