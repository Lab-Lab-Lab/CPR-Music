'use client';

import { TbZoomReset } from 'react-icons/tb';
import { MdGroups, MdOutlineWaves } from 'react-icons/md';
import { RiEqualizerLine, RiSoundModuleFill } from 'react-icons/ri';
import { Accordion, Button, Container, Modal, Row, Col } from 'react-bootstrap';
import { IoArrowUndo, IoArrowRedo, IoCutOutline, IoTrashOutline } from 'react-icons/io5';
import { BsSpeedometer2, BsSkipBackwardCircle, BsZoomOut, BsZoomIn } from 'react-icons/bs';
import { FaRegCirclePlay, FaRegCirclePause, FaArrowRotateLeft, FaArrowRotateRight } from 'react-icons/fa6';

function HelpAccordion() {
  return (
    <Accordion defaultActiveKey="0">
      <Accordion.Item eventKey="0">
        <Accordion.Header>What is a DAW?</Accordion.Header>
        <Accordion.Body>
          A DAW, which stands for "digital audio workstation", is a software program or electronic device that allows you to edit and produce audio files.
          Traditionally, DAWs are made up of four fundamental parts: a computer, an audio interface, audio editing software, and input devices.
          When compared to commercial DAWs, the MusicCPR DAW is quite rudimentary, but can still perform a number of the most common DAW functions. 
        </Accordion.Body>
      </Accordion.Item>
      <Accordion.Item eventKey="1">
        <Accordion.Header>Icons</Accordion.Header>
        <Accordion.Body>
          <Container >
              <Row className='mb-2'>
              <Col lg={1}><MdOutlineWaves fontSize="1.6rem" /></Col>
                <Col>Hides/shows minimap waveform; most useful when zooming in on segments of the larger waveform</Col>
              </Row>
              <Row className='mb-2'>
                <Col lg={1}><RiEqualizerLine fontSize="1.6rem" /></Col>
              <Col>
                Hides/shows the effects rack. The effects rack contains tabs for Equalizer, Echo, Reverb, and Chorus effects.
              </Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><IoCutOutline fontSize="1.6rem" /></Col>
              <Col>Deletes all audio other than a user highlighted region.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><IoTrashOutline fontSize="1.6rem" /></Col>
              <Col>Deletes all audio within a user highlighted region.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><IoArrowUndo fontSize="1.6rem" /></Col>
              <Col>Undo last action.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><IoArrowRedo fontSize="1.6rem" /></Col>
              <Col>Redo last action.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><FaArrowRotateLeft fontSize="1.6rem" /></Col>
              <Col>Skip playback cursor back ten seconds.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><BsSkipBackwardCircle fontSize="1.6rem" /></Col>
              <Col>Move playback cursor to 00:00.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><FaRegCirclePlay fontSize="1.6rem" /></Col>
              <Col>Play audio file</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><FaRegCirclePause fontSize="1.6rem" /></Col>
              <Col>Pause audio file.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><FaArrowRotateRight fontSize="1.6rem" /></Col>
              <Col>Skip playback cursor forward ten seconds.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><BsZoomIn fontSize="1.6rem" /></Col>
              <Col>Zoom in on waveform.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><BsZoomOut fontSize="1.6rem" /></Col>
              <Col>Zoom out on waveform.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><TbZoomReset fontSize="1.6rem" /></Col>
              <Col>Reset zoom levels to default.</Col>
            </Row>
            <Row className='mb-2'>
              <Col lg={1}><BsSpeedometer2 fontSize="1.6rem" /></Col>
              <Col>Adjust playback speed</Col>
            </Row>
          </Container>
        </Accordion.Body>
      </Accordion.Item>
      <Accordion.Item eventKey="2">
        <Accordion.Header>Effects Guide</Accordion.Header>
        <Accordion.Body>
          <h5>Audio Effects Overview</h5>
          
          <h6>Traditional Effects</h6>
          <dl>
            <dt>Equalizer (EQ)</dt>
            <dd>
              Adjusts the volume of specific frequency ranges in your audio. Boost low frequencies for more bass, 
              cut high frequencies to reduce harshness, or shape the mid-range to clarify vocals. Functions like 
              an advanced tone control.
            </dd>

            <dt>Echo</dt>
            <dd>
              Produces delayed repetitions of the original sound. Control the time between echoes and how quickly 
              they fade away. Used to create spatial depth or rhythmic effects.
            </dd>

            <dt>Reverb</dt>
            <dd>
              Simulates the acoustic properties of physical spaces by adding reflected sound. Can make audio 
              sound like it was recorded in anything from a small room to a large hall. Adds natural ambience 
              to dry recordings.
            </dd>

            <dt>Chorus</dt>
            <dd>
              Creates multiple slightly detuned copies of the sound, producing a thicker, richer texture. 
              Simulates the effect of multiple instruments or voices performing the same part simultaneously.
            </dd>
          </dl>

          <h6>Modulation Effects</h6>
          <dl>
            <dt>Phaser</dt>
            <dd>
              Combines the original signal with a phase-shifted copy, creating characteristic sweeping 
              notches in the frequency spectrum. Produces a swooshing or jet-like effect that moves 
              through the audio.
            </dd>

            <dt>Flanger</dt>
            <dd>
              Similar to phaser but uses very short delays (1-20ms) with feedback. Creates a more intense, 
              metallic sweeping effect. Often described as a "jet plane" sound.
            </dd>

            <dt>Tremolo</dt>
            <dd>
              Modulates the amplitude (volume) of the signal at a regular rate. Creates rhythmic pulsing 
              effects, commonly used in vintage guitar amplifiers and electronic music.
            </dd>

            <dt>Auto-Pan</dt>
            <dd>
              Automatically moves the sound position between left and right channels at a specified rate. 
              Creates spatial movement in the stereo field, from subtle shifts to dramatic ping-pong effects.
            </dd>

            <dt>Ring Modulator</dt>
            <dd>
              Multiplies the input signal with an oscillator, creating sum and difference frequencies. 
              Produces metallic, bell-like tones or extreme pitch effects. Often used for robotic voices 
              or experimental sound design.
            </dd>
          </dl>

          <h6>Dynamics Processing</h6>
          <dl>
            <dt>Compressor</dt>
            <dd>
              Reduces the dynamic range by attenuating signals above a threshold. Makes quiet parts louder 
              and loud parts quieter, resulting in more consistent volume levels. Essential for balancing 
              recordings and increasing perceived loudness.
            </dd>

            <dt>Gate</dt>
            <dd>
              Cuts audio that falls below a threshold level. Useful for removing background noise, breath sounds, 
              or unwanted room ambience between musical phrases. The opposite of a compressor.
            </dd>
          </dl>

          <h6>Distortion & Saturation</h6>
          <dl>
            <dt>Distortion</dt>
            <dd>
              Intentionally clips or shapes the audio waveform to add harmonic content. Ranges from subtle 
              warmth (overdrive) to aggressive clipping (distortion/fuzz). Bit crusher reduces the digital 
              resolution for lo-fi effects.
            </dd>
          </dl>

          <h6>Filter Effects</h6>
          <dl>
            <dt>Auto-Wah</dt>
            <dd>
              A filter that automatically sweeps based on the input signal's amplitude. Creates a "wah" effect 
              that responds to playing dynamics. Like a wah pedal that moves itself based on how loud you play.
            </dd>
          </dl>

          <h6>Pitch & Time Effects</h6>
          <dl>
            <dt>Pitch Shifter</dt>
            <dd>
              Changes the pitch of audio without affecting its duration. Can shift by semitones (musical intervals) 
              or cents (fine tuning). Useful for harmony creation, correction, or creative sound design.
            </dd>

            <dt>Frequency Shifter</dt>
            <dd>
              Shifts all frequencies by a fixed Hz amount, destroying harmonic relationships. Unlike pitch shifting, 
              this creates inharmonic, metallic, and alien sounds. Great for sound design and experimental effects.
            </dd>
          </dl>

          <h6>Spatial Effects</h6>
          <dl>
            <dt>Stereo Widener</dt>
            <dd>
              Enhances the stereo image to make sounds appear wider. Uses psychoacoustic techniques including 
              the Haas effect and mid/side processing. Includes bass mono retention to prevent phase issues 
              in low frequencies.
            </dd>

            <dt>Advanced Delay</dt>
            <dd>
              Sophisticated delay with additional features. Includes ping-pong mode (alternates between left/right channels), 
              feedback filtering to shape the tone of repeats, and extended delay times for complex rhythmic patterns.
            </dd>
          </dl>

          <h6>Experimental Effects</h6>
          <dl>
            <dt>Glitch/Beat Repeat</dt>
            <dd>
              Randomly or rhythmically repeats small chunks of audio. Can reverse, pitch shift, and gate 
              these chunks. Creates stuttering, glitchy effects perfect for electronic music and creative 
              sound design.
            </dd>

            <dt>Granular Freeze</dt>
            <dd>
              Captures tiny grains of audio and loops them with variations in position, pitch, and density. 
              Creates evolving textures, drones, and ethereal soundscapes from any source material.
            </dd>

            <dt>Paulstretch</dt>
            <dd>
              Extreme time-stretching algorithm that can stretch audio by 50x or more without changing pitch. 
              Creates beautiful, ambient textures by randomizing phase information. Turn any sound into an 
              evolving soundscape.
            </dd>

            <dt>Spectral Filter</dt>
            <dd>
              FFT-based frequency manipulation with multiple modes: Robot Voice (vocoder-like), Whisper 
              (removes pitched content), Harmonic Boost, Frequency Shift, Spectral Gate, and Odd Harmonics. 
              Powerful tool for sound design.
            </dd>

            <dt>Reverse Reverb</dt>
            <dd>
              Pre-verb effect where reverb comes BEFORE the sound, creating a supernatural "sucking" effect. 
              Famous for creating ethereal vocal entries and impossible acoustic spaces. Works with all 
              reverb presets.
            </dd>
          </dl>

          <p><strong>Pro Tips:</strong></p>
          <ul>
            <li>Always select a region before applying effects (except EQ which is real-time)</li>
            <li>Effects are typically most effective when applied with restraint</li>
            <li>Use Undo/Redo (arrows in toolbar) to compare before/after</li>
            <li>Experimental effects can dramatically transform your audio - save your work first!</li>
            <li>Try combining effects - apply one, then select a new region and apply another</li>
          </ul>
        </Accordion.Body>
      </Accordion.Item>
      <Accordion.Item eventKey="3">
        <Accordion.Header>Other Features</Accordion.Header>
        <Accordion.Body>
          <dl>
            <dt>Highlighting/Selecting an Audio Segment</dt>
            <dd>
              To highlight a region so that you can make edits to only a specific segment of your recording,
              click the waveform with your mouse, hold the mouse button, and drag the mouse to the left or right.
            </dd>
            <dt>Deselecting an Audio Segment</dt>
            <dd>
              By default, creating a new segment is locked when a region currently exists on the waveform.
              To deselect a segment and allow creation of a new highlighted region, hover your mouse over your highlighted region
              and double click it.
            </dd>
            <dt>Moving a Highlighted Segment</dt>
            <dd>
              To move a highlighted segment to a different location on the waveform, simply click and drag to the left or right.
            </dd>
            <dt>Resizing a Highlighted Segment</dt>
            <dd>
              To resize a highlighted audio segment, hover your mouse over the left or right edge of the region
              until you see the shape of the mouse cursor change to a double-sided arrow
              (Region endpoints have a different color to assist in this task).
              Once changed, click and drag to extend or shrink your highlighted region.
            </dd>
          </dl>
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  );
}

export default function HelpModal({ setFn, shown }) {
  return (
    <Modal
      size="lg"
      show={shown}
      onHide={() => setFn(false)}
      style={{ maxHeight: '96%' }}
    >
      <Modal.Header
        style={{ background: 'var(--daw-timeline-bg)', color: 'white' }}
      >
        <Modal.Title>DAW Help</Modal.Title>
      </Modal.Header>
      <Modal.Body
        style={{ overflow: 'scroll', backgroundColor: 'var(--daw-grey' }}
      >
        <HelpAccordion />
      </Modal.Body>
      <Modal.Footer style={{ backgroundColor: 'var(--daw-timeline-bg' }}>
        <Button variant="primary" onClick={() => setFn(false)}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}