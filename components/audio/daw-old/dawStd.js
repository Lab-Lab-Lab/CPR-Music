'use client';

import HelpAccordion from './dawHelp';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { GrHelpBook } from "react-icons/gr";
import { useWavesurfer } from '@wavesurfer/react';
import Zoom from 'wavesurfer.js/dist/plugins/zoom.esm.js';
import Hover from 'wavesurfer.js/dist/plugins/hover.esm.js';
import Minimap from 'wavesurfer.js/dist/plugins/minimap.esm.js';
import Timeline from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { WidgetSlider, ReverbChorusWidget, EQSliders } from './control';
import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { DawControlsBottom, DawControlsTop, MinimapContainer  } from './common';
import { Button, Card, CardBody, CardHeader, CardTitle, Modal, Spinner } from 'react-bootstrap';
import { loadFfmpeg, formatTime, setupAudioContext, effectChorusReverb } from '../../../lib/dawUtils';

const EQWIDTH = 28;
const RVBWIDTH = 13;
const CHRWIDTH = 18;

// const ORIGURL = '/sample_audio/uncso-bruckner4-1.mp3';
// const { audio, filters } = setupAudioContext();

const HelpModal = ({ setFn, shown }) => {
  return (
    <>
      <Modal size='lg' show={shown} onHide={() => setFn(false)} style={{maxHeight: "96%"}}>
        <Modal.Header style={{background: "var(--daw-timeline-bg)", color: "white" }}>
          <Modal.Title>DAW Help</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{overflow: "scroll", backgroundColor: "var(--daw-grey"}}>
          <HelpAccordion />
        </Modal.Body>
        <Modal.Footer style={{backgroundColor: "var(--daw-timeline-bg"}}>
          <Button variant="primary" onClick={() => setFn(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default function DawStd({ takeURL }) {
  if (!takeURL) return (<Spinner />);

  // just being paranoid I guess
  const ORIGURL = JSON.parse(JSON.stringify(takeURL));
  const { audio, filters } = setupAudioContext();

  let zoom, hover, minimap, timeline, regions;
  let disableRegionCreate;

  const dawRef = useRef(null);
  const audioRef = useRef(audio);
  const ffmpegRef = useRef(new FFmpeg());

  const [decay, setDecay] = useState(0);
  const [delay, setDelay] = useState(0);
  const [inGain, setInGain] = useState(0);
  const [outGain, setOutGain] = useState(0);
  const [speedChr, setSpeedChr] = useState(0);
  const [delayChr, setDelayChr] = useState(0);
  const [decayChr, setDecayChr] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [depthsChr, setDepthsChr] = useState(0);
  const [inGainChr, setInGainChr] = useState(0);
  const [cutRegion, setCutRegion] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [outGainChr, setOutGainChr] = useState(0);
  const [audioURL, setAudioURL] = useState(ORIGURL);
  const [isLoading, setIsLoading] = useState(false);
  const [eqPresent, setEqPresent] = useState(false);
  const [mapPresent, setMapPrsnt] = useState(false);
  const [editList, setEditList] = useState([ORIGURL]);
  const [rvbPresent, setRvbPresent] = useState(false);
  const [chrPresent, setChrPresent] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [editListIndex, setEditListIndex] = useState(0);

  const chorusSliders = [
    WidgetSlider(0, 1, 0.001, 0, setInGainChr, 'Input'),
    WidgetSlider(0, 1, 0.001, 0, setOutGainChr, 'Output'),
    WidgetSlider(0, 70, 0.1, 0, setDelayChr, 'Delay'),
    WidgetSlider(0.01, 1, 0.001, 0.01, setDecayChr, 'Decay'),
    WidgetSlider(0.1, 90000.0, 0.1, 1000, setSpeedChr, 'Speed'),
    WidgetSlider(0.01, 4, 0.001, 1, setDepthsChr, 'Depth'),
  ];

  const reverbSliders = [
    WidgetSlider(0, 1, 0.001, 0, setInGain, 'Input'),
    WidgetSlider(0, 1, 0.001, 0, setOutGain, 'Output'),
    WidgetSlider(0.1, 90000.0, 1, 1000, setDelay, 'Delay'),
    WidgetSlider(0.1, 1, 0.001, 0.1, setDecay, 'Decay'),
  ];

  useEffect(() => {
    console.log('blobs', editList);
  }, [editList]);

  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    height: 208,
    media: audio,
    barHeight: 0.8,
    cursorWidth: 2,
    autoScroll: true,
    dragToSeek: true,
    container: dawRef,
    waveColor: '#7bafd4',
    cursorColor: 'var(--jmu-gold)',
    hideScrollbar: false,
    progressColor: '#92ce84',
    plugins: useMemo(() => [], []),
  });

  wavesurfer?.once('ready', () => {
    if (wavesurfer.getActivePlugins().length === 0) {
      zoom = wavesurfer?.registerPlugin(
        Zoom.create({
          deltaThreshold: 5,
          maxZoom: 150,
          scale: 0.125,
        })
      );

      hover = wavesurfer?.registerPlugin(
        Hover.create({
          lineWidth: 2,
          labelSize: 12,
          labelColor: '#fff',
          formatTimeCallback: formatTime,
          lineColor: 'var(--jmu-gold)',
        })
      );

      minimap = wavesurfer?.registerPlugin(
        Minimap.create({
          height: 35,
          dragToSeek: true,
          container: '#mmap',
          waveColor: '#b999aa',
          cursorColor: 'var(--jmu-gold)',
          progressColor: '#92ceaa',
          cursorWidth: 2,
        })
      );

      timeline = wavesurfer?.registerPlugin(
        Timeline.create({
          height: 24,
          insertPosition: 'beforebegin',
          style: 'color: #e6dfdc; background-color: var(--daw-timeline-bg)',
        })
      );

      regions = wavesurfer?.registerPlugin(RegionsPlugin.create());
      disableRegionCreate = regions?.enableDragSelection({
        color: 'rgba(155, 115, 215, 0.4)', // FIXME @mfwolffe color param has no effect
      });
      regions?.on('region-created', (region) => {
        disableRegionCreate();
        setCutRegion(region);
      });
      regions?.on('region-double-clicked', (region) => {
        region.remove();
        disableRegionCreate = regions.enableDragSelection();
      });
    }

    if (!loaded) loadFfmpeg(ffmpegRef, setLoaded, setIsLoading);
  });

  useEffect(() => {
    async function updatePlaybackSpeed() {
      const ffmpeg = ffmpegRef.current;
      await ffmpeg.writeFile('input.mp3', await fetchFile(ORIGURL));
      await ffmpeg.exec([
        '-i',
        'input.mp3',
        '-af',
        `atempo=${playbackSpeed}`,
        'output.mp3',
      ]);

      const data = await ffmpeg.readFile('output.mp3');
      if (audioRef.current) {
        audioRef.current.src = URL.createObjectURL(
          new Blob([data.buffer], { type: 'audio/mp3' })
        );
      }

      setAudioURL(audioRef.current.src);
      console.log('speed adjust done', audioRef.current.src);
      wavesurfer.load(audioRef.current.src);
    }

    if (ffmpegRef.current.loaded) updatePlaybackSpeed();
  }, [playbackSpeed]);

  console.log('plugins:', wavesurfer?.getActivePlugins());

  const params = {
    audioRef: audioRef,
    setAudioURL: setAudioURL,
    audioURL: audioURL,
    wavesurfer: wavesurfer,
    setEditList: setEditList,
    editList: editList,
    setEditListIndex: setEditListIndex,
    editListIndex: editListIndex,
    hasButton: true,
    ffmpegRef: ffmpegRef,
    ffmpegLoaded: loaded,
    handler: effectChorusReverb,
  };

  const handleHelp = useCallback(() => {
    setShowHelp(true);
  });

  return (
    <>
      <HelpModal setFn={setShowHelp} shown={showHelp} />
      <Card className="mt-2 mb-2">
        <CardHeader className="pt-1 pb-1 flex-between">
          <CardTitle className="pt-0 pb-0 mt-0 mb-0">Audio Editor</CardTitle>
          <Button className='help-button daw-help align-center' onClick={() => handleHelp()}>
            <GrHelpBook className="help-ico" fontSize="1.5rem" />
          </Button>
        </CardHeader>
        <CardBody>
          <div className="d-flex w-100 gap-2p" hidden={!show}>
            <div
              id="waveform-container"
              style={{
                width: `${
                  100 -
                  (rvbPresent || eqPresent || chrPresent ? 1.5 : 0) -
                  (eqPresent ? EQWIDTH : 0) -
                  (rvbPresent ? RVBWIDTH : 0) -
                  (chrPresent ? CHRWIDTH : 0)
                }%`,
              }}
            >
              <DawControlsTop
                mapPresent={mapPresent}
                mapSetter={setMapPrsnt}
                eqSetter={setEqPresent}
                eqPresent={eqPresent}
                cutRegion={cutRegion}
                rvbPresent={rvbPresent}
                rvbSetter={setRvbPresent}
                chrPresent={chrPresent}
                chrSetter={setChrPresent}
                {...params}
              />
              <div
                ref={dawRef}
                id="waveform"
                className="ml-auto mr-auto mb-0 mt-0"
              />
              {MinimapContainer(!mapPresent)}
              <DawControlsBottom
                wavesurfer={wavesurfer}
                playbackSpeed={playbackSpeed}
                speedSetter={setPlaybackSpeed}
              />
            </div>
            {EQSliders(!eqPresent, filters, EQWIDTH)}
            <ReverbChorusWidget
              hide={!rvbPresent}
              width={RVBWIDTH}
              sliders={reverbSliders}
              title={'Reverb'}
              inGainChr={inGain}
              outGainChr={outGain}
              delayChr={delay}
              decayChr={decay}
              speedChr={null}
              depthsChr={null}
              {...params}
            />
            <ReverbChorusWidget
              hide={!chrPresent}
              width={CHRWIDTH}
              sliders={chorusSliders}
              title={'Chorus'}
              inGainChr={inGainChr}
              outGainChr={outGainChr}
              delayChr={delayChr}
              decayChr={decayChr}
              speedChr={speedChr}
              depthsChr={depthsChr}
              {...params}
            />
          </div>
        </CardBody>
      </Card>
    </>
  );
}