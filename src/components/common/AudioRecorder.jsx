import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, MessageSquare, Edit3, Check } from 'lucide-react';

export default function AudioRecorder({ onRecordingComplete, label = "Record Your Answer" }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const playbackRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptBufferRef = useRef('');

  useEffect(() => {
    // Check for native browser SpeechRecognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let current = '';
        for (let i = 0; i < event.results.length; i++) {
          current += event.results[i][0].transcript + ' ';
        }
        transcriptBufferRef.current = current;
        setTranscript(current);
        setEditedTranscript(current);
      };

      recognition.onerror = (err) => {
        console.warn("Speech recognition warning:", err);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      transcriptBufferRef.current = '';
      setTranscript('');
      setEditedTranscript('');

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        const finalTranscript = transcriptBufferRef.current || transcript;
        if (onRecordingComplete) {
          onRecordingComplete(audioBlob, url, finalTranscript, recordingSeconds);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      // Start SpeechRecognition if available
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.warn("Recognition already started or error:", e);
        }
      }

      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      // If mic fails, allow manual text answer input
      alert("Microphone access could not be initialized. You can still type your speaking response directly into the transcript box below for automated scoring!");
      setIsEditingTranscript(true);
      console.warn("Microphone access error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  };

  const togglePlayback = () => {
    if (!playbackRef.current) return;
    if (isPlaying) {
      playbackRef.current.pause();
      setIsPlaying(false);
    } else {
      playbackRef.current.play();
      setIsPlaying(true);
    }
  };

  const deleteRecording = () => {
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
    }
    setAudioURL(null);
    setIsPlaying(false);
    setRecordingSeconds(0);
    setTranscript('');
    setEditedTranscript('');
    transcriptBufferRef.current = '';
    if (onRecordingComplete) {
      onRecordingComplete(null, null, '', 0);
    }
  };

  const saveManualTranscript = () => {
    setIsEditingTranscript(false);
    setTranscript(editedTranscript);
    transcriptBufferRef.current = editedTranscript;
    const words = editedTranscript.trim().split(/\s+/).filter(Boolean).length;
    const estimatedDuration = Math.max(20, Math.round(words / 2.2));
    if (onRecordingComplete) {
      onRecordingComplete(null, audioURL, editedTranscript, recordingSeconds || estimatedDuration);
    }
  };

  const formatSecs = (sec) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!isRecording && !audioURL && (
            <button
              className="btn btn-primary"
              onClick={startRecording}
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              <Mic size={16} />
              <span>{label}</span>
            </button>
          )}

          {isRecording && (
            <button
              className="btn btn-danger"
              onClick={stopRecording}
              style={{ borderRadius: 'var(--radius-pill)', animation: 'pulse 1.5s infinite' }}
            >
              <Square size={16} fill="currentColor" />
              <span>Stop Recording ({formatSecs(recordingSeconds)})</span>
            </button>
          )}

          {audioURL && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <audio
                ref={playbackRef}
                src={audioURL}
                onEnded={() => setIsPlaying(false)}
              />
              <button
                className="btn btn-secondary"
                onClick={togglePlayback}
                style={{ borderRadius: 'var(--radius-pill)' }}
              >
                {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                <span>{isPlaying ? 'Pause' : 'Review Recording'}</span>
              </button>
              <button
                className="btn btn-ghost"
                onClick={deleteRecording}
                title="Delete and re-record"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}

          {!isRecording && !audioURL && !transcript && (
            <button
              className="btn btn-ghost"
              onClick={() => setIsEditingTranscript(true)}
              style={{ fontSize: 12.5, color: 'var(--text-muted)' }}
            >
              <Edit3 size={13} />
              <span>Type response text</span>
            </button>
          )}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {isRecording ? (
            <span style={{ color: 'var(--accent-red)', fontWeight: 500 }}>● Live Speech Capture active...</span>
          ) : audioURL || transcript ? (
            <span style={{ color: 'var(--accent-green)' }}>✓ Speech captured ({formatSecs(recordingSeconds || 25)})</span>
          ) : (
            <span>Web Speech API transcription ready</span>
          )}
        </div>
      </div>

      {/* Manual Input or Edit Mode */}
      {isEditingTranscript ? (
        <div style={{
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>
              Speech Transcript / Answer Input
            </span>
            <button
              className="btn btn-primary"
              onClick={saveManualTranscript}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              <Check size={13} />
              <span>Save & Use for Scoring</span>
            </button>
          </div>
          <textarea
            style={{ width: '100%', minHeight: 70, fontSize: 13, background: 'var(--bg-card)' }}
            placeholder="Type your spoken answer here..."
            value={editedTranscript}
            onChange={(e) => setEditedTranscript(e.target.value)}
          />
        </div>
      ) : transcript ? (
        /* Live / Recorded Speech Transcript */
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px',
          fontSize: 13,
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
            <MessageSquare size={15} color="var(--accent-purple)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                Transcribed Speech
              </span>
              <span style={{ color: 'var(--text-primary)' }}>"{transcript.trim()}"</span>
            </div>
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setEditedTranscript(transcript);
              setIsEditingTranscript(true);
            }}
            style={{ padding: '2px 8px', fontSize: 11.5, color: 'var(--text-muted)' }}
          >
            <Edit3 size={12} />
            <span>Edit</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
