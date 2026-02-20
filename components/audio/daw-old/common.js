'use client';

import { TbZoomReset } from 'react-icons/tb';
import { useCallback, useState } from 'react';
import { MdOutlineWaves, MdGroups } from 'react-icons/md';
import { Button, Dropdown, Spinner } from 'react-bootstrap';
import { RiSoundModuleFill, RiEqualizerLine } from 'react-icons/ri';
import { effectSliceRegions, formatTime, restoreState } from '../../../lib/dawUtils';
import { IoArrowUndo, IoTrashOutline, IoArrowRedo, IoCutOutline } from 'react-icons/io5';
import { BsSkipBackwardCircle, BsSpeedometer2, BsZoomIn, BsZoomOut } from 'react-icons/bs';
import { FaRegCirclePlay, FaRegCirclePause, FaArrowRotateLeft, FaArrowRotateRight } from 'react-icons/fa6';

const icoSize = "1.25rem";
const playButton = <FaRegCirclePlay fontSize={icoSize} />;
const dawSpinner = <Spinner animation="grow" size="sm" />;
const pauseButton = <FaRegCirclePause fontSize={icoSize} />;
const backTenButton = <FaArrowRotateLeft fontSize={icoSize} />;
const skipTenButton = <FaArrowRotateRight fontSize={icoSize} />;
const skipStartButton = <BsSkipBackwardCircle fontSize={icoSize} />;

const MinimapContainer = function (hide) {
  const hidden = hide;

  return (
    <div
      className="w-100 ml-auto mr-auto mmap-container"
      id="mmap"
      hidden={hidden}
    />
  );
};

const DawControlsBottom = ({
  wavesurfer,
  playbackSpeed,
  speedSetter,
}) => {
  if (!wavesurfer) return '';

  const [zoomLevel, setZoomLevel] = useState(15);

  const onSkipTenFwd = useCallback(() => {
    wavesurfer.skip(10);
  });

  const onSkipTenBkwd = useCallback(() => {
    wavesurfer.skip(-10);
  });

  const onPlayPause = useCallback(() => {
    wavesurfer && wavesurfer.playPause();
  }, [wavesurfer]);

  const onStopSeekZero = useCallback(() => {
    wavesurfer.seekTo(0);
    wavesurfer.isPlaying() && wavesurfer.pause();
  });

  return (
    <div className="d-flex w-100 ml-auto mr-auto prog-bar align-items-center flex-between flex gap-0375">
      <div className="d-flex gap-05 align-items-center">
        <Button onClick={onSkipTenBkwd} className="prog-button pl-2">
          {backTenButton}
        </Button>
        <Button className="prog-button" onClick={onStopSeekZero}>
          {skipStartButton}
        </Button>
        <Button onClick={onPlayPause} className="prog-button">
          {wavesurfer.isPlaying() ? pauseButton : playButton}
        </Button>
        <Button onClick={onSkipTenFwd} className="prog-button">
          {skipTenButton}
        </Button>
        <span
          className="pl-1 pt-0 pb-0 mt-0 mb-0"
          style={{ color: wavesurfer.isPlaying() ? 'aqua' : 'white' }}
        >
          {formatTime(wavesurfer.getCurrentTime())}
        </span>
      </div>

      <div className="d-flex gap-0375 align-items-center">
        <Button
          className="prog-button"
          onClick={() => {
            setZoomLevel(zoomLevel + 25);
            wavesurfer.zoom(zoomLevel);
          }}
        >
          <BsZoomIn fontSize={icoSize} />
        </Button>

        <Button
          className="prog-button"
          onClick={() => {
            const zoom = zoomLevel - 25;
            setZoomLevel(zoom < 0 ? 0 : zoom);
            wavesurfer.zoom(zoomLevel);
          }}
        >
          <BsZoomOut fontSize={icoSize} />
        </Button>

        <Button className="prog-button">
          <TbZoomReset
            fontSize={icoSize}
            onClick={() => {
              setZoomLevel(0);
              wavesurfer.zoom(0);
            }}
          />
        </Button>
        <Dropdown
          className="pr-2"
          drop="up-centered"
          onSelect={(eventKey) => speedSetter(eventKey)}
        >
          <Dropdown.Toggle
            className="prog-button mt-0 mb-0 pt-0 pb-0"
            id="dropdown-basic"
          >
            <BsSpeedometer2 fontSize={icoSize} />
          </Dropdown.Toggle>
          <Dropdown.Menu className="bg-daw-toolbars">
            <Dropdown.Item className="text-white" eventKey={2}>
              2x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey={1.75}>
              1.75x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey={1.5}>
              1.5x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey={1.25}>
              1.25x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey={1}>
              1x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey={0.75}>
              0.75x
            </Dropdown.Item>
            <Dropdown.Item className="text-white" eventKey={0.5}>
              0.5x
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </div>
  );
};

const DawControlsTop = ({
  wavesurfer,
  mapPresent,
  mapSetter,
  eqPresent,
  eqSetter,
  rvbPresent,
  rvbSetter,
  cutRegion,
  ffmpegLoaded,
  chrPresent,
  chrSetter,
  editListIndex,
  editList,
  setEditList,
  setEditListIndex,
  setAudioURL,
  audioRef,
  ffmpegRef,
  audioURL,
}) => {
  if (!wavesurfer) return '';

  const [eqHvr, setEqHvr] = useState(false);
  const [mapHvr, setMapHvr] = useState(false);
  const [rvbHvr, setRvbHvr] = useState(false);
  const [chrHvr, setChrHvr] = useState(false);

  const handleMinimap = useCallback(() => {
    mapSetter(!mapPresent);
  });

  const toggleEQ = useCallback(() => {
    eqSetter(!eqPresent);
  });

  const toggleRvb = useCallback(() => {
    rvbSetter(!rvbPresent);
  });

  const toggleChorus = useCallback(() => {
    chrSetter(!chrPresent);
  });

  const sliceRegion = (keep) => {
    effectSliceRegions(
      cutRegion,
      ffmpegRef,
      setAudioURL,
      wavesurfer,
      setEditList,
      editList,
      setEditListIndex,
      editListIndex,
      audioRef,
      audioURL,
      keep,
    ).then(() => {
      cutRegion.remove();
    } ).catch((e) => {console.error(e);
    });
  };

  return (
    <>
      <div className="d-flex w-100 ml-auto mr-auto pl-2 toolbar align-items-center flex-row flex-between gap-0375">
        <div className="d-flex gap-05 align-items-center">
          <Button className="prog-button" onClick={handleMinimap}>
            <MdOutlineWaves
              fontSize={icoSize}
              onPointerEnter={() => setMapHvr(true)}
              onPointerLeave={() => setMapHvr(false)}
              style={{ color: mapPresent || mapHvr ? 'aqua' : 'white' }}
            />
          </Button>
          <Button className="prog-button" onClick={toggleEQ}>
            <RiEqualizerLine
              fontSize={icoSize}
              onPointerEnter={() => setEqHvr(true)}
              onPointerLeave={() => setEqHvr(false)}
              style={{ color: eqPresent || eqHvr ? 'aqua' : 'white' }}
            />
          </Button>
          <Button className="prog-button" onClick={toggleRvb}>
            {ffmpegLoaded ? (
              <RiSoundModuleFill
                fontSize={icoSize}
                onPointerEnter={() => setRvbHvr(true)}
                onPointerLeave={() => setRvbHvr(false)}
                style={{ color: rvbPresent || rvbHvr ? 'aqua' : 'white' }}
              />
            ) : (
              dawSpinner
            )}
          </Button>
          <Button className="prog-button" onClick={toggleChorus}>
            {ffmpegLoaded ? (
              <MdGroups
                onPointerEnter={() => setChrHvr(true)}
                onPointerLeave={() => setChrHvr(false)}
                style={{ color: chrPresent || chrHvr ? 'aqua' : 'white' }}
                fontSize={icoSize}
              />
            ) : (
              dawSpinner
            )}
          </Button>
          <Button className="prog-button">
            {ffmpegLoaded ? (
              <IoCutOutline fontSize={icoSize} onClick={() => sliceRegion(true)} />
            ) : (
              dawSpinner
            )}
          </Button>
          <Button className="prog-button">
            {ffmpegLoaded ? (
              <IoTrashOutline
                fontSize={icoSize}
                onClick={() => sliceRegion(false)}
              />
            ) : (
              dawSpinner
            )}
          </Button>
        </div>
        <div className="d-flex align-items-center">
          <Button
            className="prog-button pr-2"
            onClick={() =>
              restoreState(
                editListIndex - 1,
                editList,
                setEditListIndex,
                wavesurfer
              )
            }
          >
            <IoArrowUndo fontSize={icoSize} />
          </Button>
          <Button
            className="prog-button pr-2"
            onClick={() =>
              restoreState(
                editListIndex + 1,
                editList,
                setEditListIndex,
                wavesurfer
              )
            }
          >
            <IoArrowRedo fontSize={icoSize} />
          </Button>
        </div>
      </div>
    </>
  );
};

export { MinimapContainer, DawControlsBottom, DawControlsTop };
