import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Play, Pause, SkipBack, SkipForward, Loader2, Film } from 'lucide-react';
import Waveform, { WaveformHandle } from '../components/Waveform';
import { projectsApi, lyricsApi, mediaApi } from '../lib/api';
import toast from 'react-hot-toast';
import { templates, templateCategories, suggestTemplates } from '../data/templates';
import ExportModal from '../components/ExportModal';
import VideoPreview from '../components/VideoPreview';
import StoryboardPreview from '../components/StoryboardPreview';

interface Project {
  id: string;
  title: string;
  artist: string;
  audio_url: string;
  album_art_url: string | null;
  duration_seconds: number;
  config: {
    template: string;
    fontSize: number;
    fontFamily: string;
    animation: string;
  };
  status: string;
  created_at: string;
  updated_at: string;
}

interface LyricLine {
  text: string;
  startTime: number | null;
  endTime: number | null;
}

export default function ProjectEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lyrics, setLyrics] = useState('');
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [syncingLineIndex, setSyncingLineIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'lyrics' | 'timing' | 'style'>('lyrics');
  const [playingLineIndex, setPlayingLineIndex] = useState<number | null>(null);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const waveformRef = useRef<WaveformHandle | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [suggestedTemplates, setSuggestedTemplates] = useState<string[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showStoryboard, setShowStoryboard] = useState(false);
  const [previewMode, setPreviewMode] = useState<'static' | 'animated'>('static');
  const [albumArtUrl, setAlbumArtUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleAlbumArtUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    try {
      setUploadingImage(true);
      const response: any = await mediaApi.uploadImage(file);
      const imageUrl = response.data.url;

      // Update project with album art URL
      await projectsApi.update(id, { albumArtUrl: imageUrl });
      setAlbumArtUrl(imageUrl);
      toast.success('Album art uploaded!');
    } catch (error) {
      console.error('Album art upload failed:', error);
      toast.error('Failed to upload album art');
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [id]);

  useEffect(() => {
    // Parse lyrics when switching to timing tab
    if (activeTab === 'timing' && lyrics.trim() && lyricLines.length === 0) {
      parseLyricsToLines();
    }
  }, [activeTab, lyrics]);

  useEffect(() => {
    // Keyboard shortcut for syncing (spacebar)
    const handleKeyPress = (e: KeyboardEvent) => {
      if (activeTab === 'timing' && syncingLineIndex !== null && e.code === 'Space') {
        e.preventDefault();
        handleSetTimestamp(syncingLineIndex);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [activeTab, syncingLineIndex, currentTime, lyricLines]);

  useEffect(() => {
    // Cleanup playback when component unmounts or tab changes
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      waveformRef.current?.pause();
      setPlayingLineIndex(null);
    };
  }, [activeTab]);

  const loadProject = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const response: any = await projectsApi.getById(id);
      setProject(response.data);
      setAlbumArtUrl(response.data.album_art_url);

      // Load lyrics for this project
      await loadLyrics();
    } catch (error: any) {
      console.error('Failed to load project:', error);
      toast.error('Failed to load project');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadLyrics = async () => {
    if (!id) return;

    try {
      const response: any = await lyricsApi.getByProject(id);
      const savedLyrics = response.data || [];

      if (savedLyrics.length > 0) {
        // Convert database format to editor format
        const lines = savedLyrics.map((lyric: any) => ({
          text: lyric.text,
          startTime: lyric.start_time,
          endTime: lyric.end_time,
        }));
        setLyricLines(lines);

        // Also populate the lyrics text area
        const lyricsText = savedLyrics.map((l: any) => l.text).join('\n');
        setLyrics(lyricsText);
      }
    } catch (error) {
      console.error('Failed to load lyrics:', error);
      // Don't show error toast - lyrics might just not exist yet
    }
  };

  const parseLyricsToLines = () => {
    const lines = lyrics
      .split('\n')
      .filter(line => line.trim())
      .map(text => ({
        text,
        startTime: null,
        endTime: null,
      }));
    setLyricLines(lines);
    setSyncingLineIndex(0);
  };

  const handleSetTimestamp = (index: number) => {
    const updatedLines = [...lyricLines];
    const wasAlreadySynced = updatedLines[index].startTime !== null;

    updatedLines[index].startTime = currentTime;

    // Set end time of previous line
    if (index > 0 && updatedLines[index - 1].endTime === null) {
      updatedLines[index - 1].endTime = currentTime;
    }

    // Update end time of current line if next line exists
    if (index < lyricLines.length - 1 && updatedLines[index + 1].startTime !== null) {
      updatedLines[index].endTime = updatedLines[index + 1].startTime;
    }

    setLyricLines(updatedLines);

    if (wasAlreadySynced) {
      toast.success('Timestamp adjusted!');
    } else {
      // Move to next line only if syncing sequentially
      if (syncingLineIndex === index && index < lyricLines.length - 1) {
        setSyncingLineIndex(index + 1);
      } else if (index === lyricLines.length - 1) {
        setSyncingLineIndex(null);
        toast.success('All lyrics synced!');
      }
    }
  };

  const handleResetSync = () => {
    const resetLines = lyricLines.map(line => ({
      ...line,
      startTime: null,
      endTime: null,
    }));
    setLyricLines(resetLines);
    setSyncingLineIndex(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const adjustTimestamp = (index: number, adjustment: number) => {
    const updatedLines = [...lyricLines];
    const currentTimestamp = updatedLines[index].startTime;

    if (currentTimestamp === null) return;

    const newTimestamp = Math.max(0, currentTimestamp + adjustment);
    updatedLines[index].startTime = newTimestamp;

    // Update end time of previous line
    if (index > 0) {
      updatedLines[index - 1].endTime = newTimestamp;
    }

    // Update end time of current line if next line exists
    if (index < lyricLines.length - 1 && updatedLines[index + 1].startTime !== null) {
      updatedLines[index].endTime = updatedLines[index + 1].startTime;
    }

    setLyricLines(updatedLines);

    // If this line is currently playing, automatically re-seek to the new position
    if (playingLineIndex === index && waveformRef.current) {
      const startTime = Math.max(0, newTimestamp - 0.5);
      waveformRef.current.seekTo(startTime);
      waveformRef.current.play();
    }
  };

  const playLineSegment = async (index: number) => {
    const line = lyricLines[index];
    if (!line.startTime || !waveformRef.current) {
      toast.error('No timestamp set for this line');
      return;
    }

    // Clear any existing playback interval
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }

    // If already playing this line, pause it
    if (playingLineIndex === index) {
      waveformRef.current.pause();
      setPlayingLineIndex(null);
      return;
    }

    const startTime = Math.max(0, line.startTime - 0.5); // Start 0.5s before
    const endTime = line.endTime || line.startTime + 5; // Default 5s duration if no end time

    try {
      setPlayingLineIndex(index);

      // Use the Waveform player to seek and play
      waveformRef.current.seekTo(startTime);

      // Wait a moment for seek to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      waveformRef.current.play();

      // Monitor playback and pause at the end of the segment
      playIntervalRef.current = setInterval(() => {
        if (currentTime >= endTime) {
          waveformRef.current?.pause();
          if (playIntervalRef.current) {
            clearInterval(playIntervalRef.current);
            playIntervalRef.current = null;
          }
          setPlayingLineIndex(null);
        }
      }, 50);
    } catch (error) {
      console.error('Failed to play audio:', error);
      toast.error('Failed to play audio segment');
      setPlayingLineIndex(null);
    }
  };

  const updateConfig = async (updates: Partial<Project['config']>) => {
    if (!project) return;

    const updatedConfig = { ...project.config, ...updates };
    setProject({ ...project, config: updatedConfig });

    try {
      await projectsApi.update(project.id, {
        config: updatedConfig,
      });
      toast.success('Style updated!');
    } catch (error) {
      console.error('Failed to update config:', error);
      toast.error('Failed to update style');
    }
  };

  const getSuggestions = () => {
    if (!project) return;
    const suggestions = suggestTemplates(project.title, project.artist, lyrics);
    setSuggestedTemplates(suggestions);
    toast.success(`Found ${suggestions.length} templates that match your song!`);
  };

  const handleExport = () => {
    if (!project) return;
    setShowExportModal(true);
  };

  const handleSave = async () => {
    if (!project) return;

    setSaving(true);
    try {
      // Save project with all changes including config
      await projectsApi.update(project.id, {
        title: project.title,
        artist: project.artist,
        config: project.config, // Save all configuration (template, animations, effects, etc.)
      });

      // Save lyrics if they exist
      if (lyricLines && lyricLines.length > 0) {
        try {
          const lyricsToSave = lyricLines.map(line => ({
            text: line.text,
            startTime: line.startTime ?? 0,
            endTime: line.endTime ?? 0,
          }));
          await lyricsApi.save(project.id, lyricsToSave);
        } catch (lyricsError) {
          console.error('Failed to save lyrics:', lyricsError);
          toast.error('Project saved but lyrics failed to save');
          return;
        }
      }

      toast.success('Project saved successfully!');
    } catch (error: any) {
      console.error('Failed to save:', error);
      toast.error('Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">Project not found</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary mt-4">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-dark-700 bg-dark-800">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-display font-bold">{project.title}</h1>
              <p className="text-sm text-gray-400">{project.artist}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Album Art Upload */}
            <div className="relative">
              <input
                type="file"
                id="album-art-upload"
                accept="image/*"
                onChange={handleAlbumArtUpload}
                className="hidden"
              />
              <label
                htmlFor="album-art-upload"
                className={`btn flex items-center gap-2 cursor-pointer ${uploadingImage ? 'opacity-50' : ''}`}
              >
                {uploadingImage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : albumArtUrl ? (
                  <>
                    <img src={albumArtUrl} className="w-6 h-6 rounded object-cover" alt="Album art" />
                    Change Cover
                  </>
                ) : (
                  <>
                    🎨 Add Cover Art
                  </>
                )}
              </label>
            </div>
            <span className="text-sm text-gray-400">
              {Math.floor(project.duration_seconds / 60)}:{(project.duration_seconds % 60).toString().padStart(2, '0')}
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-dark-700 bg-dark-800">
            <div className="flex px-6">
              <button
                onClick={() => setActiveTab('lyrics')}
                className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === 'lyrics'
                    ? 'border-primary-500 text-white'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                Lyrics
              </button>
              <button
                onClick={() => setActiveTab('timing')}
                className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === 'timing'
                    ? 'border-primary-500 text-white'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                Timing
              </button>
              <button
                onClick={() => setActiveTab('style')}
                className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                  activeTab === 'style'
                    ? 'border-primary-500 text-white'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                Style
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-6">
            {activeTab === 'lyrics' && (
              <div className="max-w-4xl mx-auto">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold mb-2">Enter Lyrics</h2>
                  <p className="text-sm text-gray-400">
                    Type or paste your lyrics here. Each line will be displayed separately in the video.
                  </p>
                </div>
                <textarea
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  placeholder="Enter lyrics here...&#10;&#10;Each line will be synced with the audio&#10;in the Timing tab"
                  className="w-full h-[500px] bg-dark-800 border border-dark-700 rounded-lg p-4 text-base font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    {lyrics.split('\n').filter(line => line.trim()).length} lines
                  </div>
                  {lyrics.trim() && (
                    <button
                      onClick={() => setActiveTab('timing')}
                      className="btn-primary text-sm"
                    >
                      Continue to Timing →
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'timing' && (
              <div className="max-w-4xl mx-auto">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold mb-2">Sync Timing</h2>
                  <p className="text-sm text-gray-400">
                    Play the audio and click (or press <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">Space</kbd>) on each line at the moment it should appear. Click synced lines again to adjust their timing.
                  </p>
                </div>

                {lyricLines.length === 0 ? (
                  <div className="card p-8 text-center">
                    <p className="text-gray-400 mb-4">
                      You need to enter lyrics first before syncing timing.
                    </p>
                    <button
                      onClick={() => setActiveTab('lyrics')}
                      className="btn-primary"
                    >
                      Go to Lyrics Tab
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Controls */}
                    <div className="card p-4 mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-sm">
                          <span className="text-gray-400">Current Time:</span>
                          <span className="ml-2 font-mono text-primary-500 font-semibold">
                            {formatTime(currentTime)}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-400">Progress:</span>
                          <span className="ml-2 font-semibold">
                            {lyricLines.filter(l => l.startTime !== null).length} / {lyricLines.length}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={handleResetSync}
                        className="btn-ghost text-sm"
                      >
                        Reset All
                      </button>
                    </div>

                    {/* Lyrics List */}
                    <div className="space-y-2">
                      {lyricLines.map((line, index) => {
                        const isSynced = line.startTime !== null;
                        const isActive = syncingLineIndex === index;
                        const isNext = syncingLineIndex !== null && index === syncingLineIndex;
                        const canClick = isNext || isSynced; // Allow clicking on synced lines to adjust

                        return (
                          <div
                            key={index}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              isActive
                                ? 'border-primary-500 bg-primary-500/10'
                                : isSynced
                                ? 'border-green-500/50 bg-green-500/5'
                                : 'border-dark-700 bg-dark-800'
                            } ${
                              !canClick && 'opacity-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 flex-1">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    isSynced
                                      ? 'bg-green-500 text-white'
                                      : isActive
                                      ? 'bg-primary-500 text-white'
                                      : 'bg-gray-700 text-gray-400'
                                  }`}
                                >
                                  {isSynced ? '✓' : index + 1}
                                </div>
                                <button
                                  onClick={() => handleSetTimestamp(index)}
                                  disabled={!canClick}
                                  className={`text-left flex-1 ${
                                    canClick ? 'cursor-pointer hover:text-white' : 'cursor-not-allowed'
                                  } ${isSynced || isActive ? 'text-white' : 'text-gray-500'}`}
                                >
                                  {line.text}
                                </button>
                              </div>

                              <div className="flex items-center gap-2">
                                {isSynced && (
                                  <>
                                    <span className="text-sm font-mono text-gray-400">
                                      {formatTime(line.startTime!)}
                                    </span>
                                    <button
                                      onClick={() => playLineSegment(index)}
                                      className={`p-1.5 hover:bg-gray-800 rounded transition-colors ${
                                        playingLineIndex === index ? 'text-primary-500' : ''
                                      }`}
                                      title={playingLineIndex === index ? 'Stop' : 'Play this line'}
                                    >
                                      {playingLineIndex === index ? (
                                        <Pause className="w-4 h-4" fill="currentColor" />
                                      ) : (
                                        <Play className="w-4 h-4" />
                                      )}
                                    </button>
                                    <div className="flex items-center gap-1 ml-2">
                                      <button
                                        onClick={() => adjustTimestamp(index, -0.5)}
                                        className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                                        title="Earlier by 0.5s"
                                      >
                                        -0.5s
                                      </button>
                                      <button
                                        onClick={() => adjustTimestamp(index, -0.1)}
                                        className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                                        title="Earlier by 0.1s"
                                      >
                                        -0.1s
                                      </button>
                                      <button
                                        onClick={() => adjustTimestamp(index, 0.1)}
                                        className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                                        title="Later by 0.1s"
                                      >
                                        +0.1s
                                      </button>
                                      <button
                                        onClick={() => adjustTimestamp(index, 0.5)}
                                        className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                                        title="Later by 0.5s"
                                      >
                                        +0.5s
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {syncingLineIndex === null && lyricLines.every(l => l.startTime !== null) && (
                      <div className="card p-6 mt-4 text-center bg-green-500/10 border-green-500/50">
                        <p className="text-green-500 font-semibold mb-2">
                          ✓ All lyrics synced successfully!
                        </p>
                        <p className="text-sm text-gray-400">
                          You can now customize the style or export your video.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'style' && (
              <div className="max-w-5xl mx-auto">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Visual Style</h2>
                    <p className="text-sm text-gray-400">
                      Choose a template that matches your song's vibe.
                    </p>
                  </div>
                  <button
                    onClick={getSuggestions}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                    Get AI Suggestions
                  </button>
                </div>

                {/* AI Suggestions */}
                {suggestedTemplates.length > 0 && (
                  <div className="card p-6 mb-6 bg-primary-500/10 border-primary-500/30">
                    <div className="flex items-center gap-2 mb-4">
                      <svg
                        className="w-5 h-5 text-primary-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                        />
                      </svg>
                      <h3 className="font-semibold text-primary-500">
                        Suggested for "{project.title}"
                      </h3>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {suggestedTemplates.map((templateId) => {
                        const template = templates.find((t) => t.id === templateId);
                        if (!template) return null;
                        return (
                          <button
                            key={template.id}
                            onClick={() => {
                              updateConfig({ template: template.id });
                              setSuggestedTemplates([]);
                            }}
                            className="group relative aspect-video rounded-lg border-2 border-primary-500/50 hover:border-primary-500 transition-all overflow-hidden"
                          >
                            <div
                              className="w-full h-full flex flex-col items-center justify-center p-3"
                              style={{
                                background: `linear-gradient(135deg, ${template.gradient.join(', ')})`,
                              }}
                            >
                              <span className="text-xs font-semibold text-white drop-shadow-lg">
                                {template.name}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Template Categories */}
                <div className="card p-6 mb-6">
                  <div className="flex gap-2 mb-6 overflow-x-auto">
                    {templateCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                          selectedCategory === cat.id
                            ? 'bg-primary-500 text-white'
                            : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>

                  {/* Template Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    {templates
                      .filter((t) => selectedCategory === 'all' || t.category === selectedCategory)
                      .map((template) => (
                        <button
                          key={template.id}
                          onClick={() => {
                            // Merge the full template config into project config
                            updateConfig({
                              template: template.id,
                              ...template.config,
                            });
                          }}
                          className={`group relative aspect-video rounded-lg border-2 transition-all overflow-hidden ${
                            project.config.template === template.id
                              ? 'border-primary-500 ring-2 ring-2-primary-500/50'
                              : 'border-dark-700 hover:border-primary-500/50'
                          }`}
                        >
                          <div
                            className="w-full h-full flex flex-col items-center justify-center p-4"
                            style={{
                              background: `linear-gradient(135deg, ${template.gradient.join(', ')})`,
                            }}
                          >
                            <span className="text-sm font-semibold text-white drop-shadow-lg mb-1">
                              {template.name}
                            </span>
                            <span className="text-xs text-white/80 drop-shadow text-center">
                              {template.description}
                            </span>
                          </div>
                          {project.config.template === template.id && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                              <svg
                                className="w-4 h-4 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                  </div>
                </div>

                {/* Font Settings */}
                <div className="card p-6 mb-6">
                  <h3 className="font-semibold mb-4">Font</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Font Family</label>
                      <select
                        className="input"
                        value={project.config.fontFamily}
                        onChange={(e) => updateConfig({ fontFamily: e.target.value })}
                      >
                        <option value="Inter">Inter</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Montserrat">Montserrat</option>
                        <option value="Playfair Display">Playfair Display</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Font Size: {project.config.fontSize}px
                      </label>
                      <input
                        type="range"
                        min="24"
                        max="96"
                        value={project.config.fontSize}
                        onChange={(e) => updateConfig({ fontSize: parseInt(e.target.value) })}
                        className="w-full accent-primary-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Effects & Animations */}
                <div className="card p-6 mb-6">
                  <h3 className="font-semibold mb-4">Effects & Animations</h3>
                  <div className="space-y-6">
                    {/* Text Animations */}
                    <div>
                      <h4 className="text-sm font-medium mb-3 text-gray-300">Text Animations (select multiple)</h4>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'fade', name: 'Fade In' },
                          { id: 'slide', name: 'Slide Up' },
                          { id: 'pop', name: 'Pop' },
                          { id: 'bounce', name: 'Bounce' },
                          { id: 'typewriter', name: 'Typewriter' },
                          { id: 'zoom', name: 'Zoom In' },
                          { id: 'rotate', name: 'Rotate' },
                          { id: 'wave', name: 'Wave' },
                          { id: 'glitch', name: 'Glitch' },
                        ].map((anim) => {
                          const animations = project.config.animations || [];
                          const isSelected = animations.includes(anim.id);
                          return (
                            <label
                              key={anim.id}
                              className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-primary-500 bg-primary-500/10'
                                  : 'border-dark-700 hover:border-gray-600'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const newAnimations = e.target.checked
                                    ? [...animations, anim.id]
                                    : animations.filter((a) => a !== anim.id);
                                  updateConfig({ animations: newAnimations });
                                }}
                                className="w-4 h-4 accent-primary-500"
                              />
                              <span className="text-sm">{anim.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Background Effects */}
                    <div>
                      <h4 className="text-sm font-medium mb-3 text-gray-300">Background Effects</h4>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'gradient-shift', name: 'Gradient Shift' },
                          { id: 'pulse', name: 'Pulse' },
                          { id: 'ken-burns', name: 'Ken Burns' },
                          { id: 'color-wave', name: 'Color Wave' },
                        ].map((effect) => {
                          const effects = project.config.backgroundEffects || [];
                          const isSelected = effects.includes(effect.id);
                          return (
                            <label
                              key={effect.id}
                              className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-500/10'
                                  : 'border-dark-700 hover:border-gray-600'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const newEffects = e.target.checked
                                    ? [...effects, effect.id]
                                    : effects.filter((ef) => ef !== effect.id);
                                  updateConfig({ backgroundEffects: newEffects });
                                }}
                                className="w-4 h-4 accent-purple-500"
                              />
                              <span className="text-sm">{effect.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Visual Effects */}
                    <div>
                      <h4 className="text-sm font-medium mb-3 text-gray-300">Visual Effects</h4>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'sparkle', name: 'Sparkle' },
                          { id: 'glow', name: 'Glow' },
                          { id: 'vignette', name: 'Vignette' },
                          { id: 'film-grain', name: 'Film Grain' },
                          { id: 'scanlines', name: 'Scanlines' },
                          { id: 'particles', name: 'Particles' },
                          { id: 'light-rays', name: 'Light Rays' },
                          { id: 'text-box', name: 'Text Box' },
                          { id: 'text-bar', name: 'Text Bar' },
                        ].map((effect) => {
                          const effects = project.config.visualEffects || [];
                          const isSelected = effects.includes(effect.id);
                          return (
                            <label
                              key={effect.id}
                              className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-pink-500 bg-pink-500/10'
                                  : 'border-dark-700 hover:border-gray-600'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const newEffects = e.target.checked
                                    ? [...effects, effect.id]
                                    : effects.filter((ef) => ef !== effect.id);
                                  updateConfig({ visualEffects: newEffects });
                                }}
                                className="w-4 h-4 accent-pink-500"
                              />
                              <span className="text-sm">{effect.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Export Section */}
                <div className="card p-6 bg-gradient-to-r from-primary-500/10 to-purple-500/10 border-primary-500/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold mb-1 flex items-center gap-2">
                        <svg
                          className="w-5 h-5 text-primary-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                          />
                        </svg>
                        Ready to Create Your Video?
                      </h3>
                      <p className="text-sm text-gray-400">
                        {lyricLines.every((l) => l.startTime !== null)
                          ? 'All lyrics are synced! Your video is ready to generate.'
                          : 'Sync your lyrics in the Timing tab first.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowStoryboard(true)}
                        disabled={!lyricLines.every((l) => l.startTime !== null)}
                        className={`btn-secondary flex items-center gap-2 px-6 py-3 ${
                          !lyricLines.every((l) => l.startTime !== null)
                            ? 'opacity-50 cursor-not-allowed'
                            : ''
                        }`}
                      >
                        <Film className="w-5 h-5" />
                        Preview Storyboard
                      </button>
                      <button
                        onClick={handleExport}
                        disabled={!lyricLines.every((l) => l.startTime !== null)}
                        className={`btn-primary flex items-center gap-2 px-6 py-3 ${
                          !lyricLines.every((l) => l.startTime !== null)
                            ? 'opacity-50 cursor-not-allowed'
                            : ''
                        }`}
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
                          />
                        </svg>
                        Generate Video
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Preview & Audio */}
        <div className="w-96 border-l border-dark-700 bg-dark-800 flex flex-col">
          {/* Preview */}
          <div className="p-6 border-b border-dark-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Preview</h3>
              <div className="flex gap-1 bg-dark-700 rounded-lg p-1">
                <button
                  onClick={() => setPreviewMode('static')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    previewMode === 'static'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Static
                </button>
                <button
                  onClick={() => setPreviewMode('animated')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    previewMode === 'animated'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Live
                </button>
              </div>
            </div>
            <VideoPreview
              key={`preview-${project.config.template}-${previewMode}`}
              currentTime={currentTime}
              lyrics={lyricLines}
              config={project.config}
              aspectRatio="16:9"
              mode={previewMode}
              staticText="The lights are changing colors"
            />
          </div>

          {/* Audio Player */}
          <div className="p-6">
            <h3 className="font-semibold mb-4">Audio</h3>
            <Waveform
              ref={waveformRef}
              audioUrl={project.audio_url}
              onTimeUpdate={setCurrentTime}
            />
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {project && (
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          projectId={project.id}
          projectTitle={project.title}
        />
      )}

      {/* Storyboard Preview */}
      {project && showStoryboard && (
        <StoryboardPreview
          lyrics={lyricLines}
          config={{
            template: project.config.template,
            fontFamily: project.config.fontFamily,
            fontSize: project.config.fontSize,
            animation: project.config.animation,
          }}
          aspectRatio="16:9"
          onClose={() => setShowStoryboard(false)}
          onExport={handleExport}
        />
      )}
    </div>
  );
}
