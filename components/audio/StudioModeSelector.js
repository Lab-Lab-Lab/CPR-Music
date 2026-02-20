'use client';

import { Modal, Card, Row, Col } from 'react-bootstrap';
import { MdMusicNote, MdVolumeOff } from 'react-icons/md';
import { FaWaveSquare } from 'react-icons/fa';
import { BiAnalyse } from 'react-icons/bi';
import { GiSoundWaves } from 'react-icons/gi';
import { IoSettingsSharp } from 'react-icons/io5';

const StudioModeSelector = ({ show, onSelectMode }) => {
  return (
    <Modal
      show={show}
      onHide={() => {}} // Prevent closing by clicking outside
      centered
      size="lg"
      backdrop="static"
      keyboard={false}
    >
      <Modal.Header className="border-0 pb-0">
        <Modal.Title className="w-100 text-center">
          <h2 className="mb-0">Select Mode</h2>
          <p className="text-muted mt-2 mb-0" style={{ fontSize: '1rem' }}>
            Choose a tool
          </p>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="pt-2 pb-4">
        <Row className="g-4 mt-2">
          {/* DAWn_EE Card */}
          <Col lg={4} md={6}>
            <Card
              className="h-100 studio-mode-card"
              style={{
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: '2px solid #dee2e6'
              }}
              onClick={() => onSelectMode('daw')}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
                e.currentTarget.style.borderColor = '#0d6efd';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#dee2e6';
              }}
            >
              <Card.Body className="text-center d-flex flex-column justify-content-center p-4">
                <div className="mb-3">
                  <div className="d-flex justify-content-center align-items-center" style={{ fontSize: '3rem', color: '#0d6efd' }}>
                    <MdMusicNote />
                    <FaWaveSquare className="ms-2" />
                  </div>
                </div>
                <h3 className="mb-2">DAWn_EE</h3>
                <p className="text-muted mb-0">
                  Digital Audio Workstation
                </p>
                <p className="small text-muted mt-2">
                  Multi-track editor, effects processing, and audio recording tools for music production
                </p>
              </Card.Body>
            </Card>
          </Col>

          {/* Silence Sandbox Card */}
          <Col lg={4} md={6}>
            <Card
              className="h-100 studio-mode-card"
              style={{
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: '2px solid #dee2e6'
              }}
              onClick={() => onSelectMode('silence-sandbox')}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
                e.currentTarget.style.borderColor = '#4682b4';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#dee2e6';
              }}
            >
              <Card.Body className="text-center d-flex flex-column justify-content-center p-4">
                <div className="mb-3">
                  <div className="d-flex justify-content-center align-items-center" style={{ fontSize: '3rem', color: '#4682b4' }}>
                    <MdVolumeOff />
                    <BiAnalyse className="ms-2" />
                  </div>
                </div>
                <h3 className="mb-2">Silence Sandbox</h3>
                <p className="text-muted mb-0">
                  Audio Analysis Tool
                </p>
                <p className="small text-muted mt-2">
                  Detect and analyze silence in audio files with customizable parameters
                </p>
              </Card.Body>
            </Card>
          </Col>

          {/* Instrument Sandbox Card */}
          <Col lg={4} md={6}>
            <Card
              className="h-100 studio-mode-card"
              style={{
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: '2px solid #dee2e6'
              }}
              onClick={() => onSelectMode('instrument-sandbox')}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
                e.currentTarget.style.borderColor = '#9b59b6';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = '#dee2e6';
              }}
            >
              <Card.Body className="text-center d-flex flex-column justify-content-center p-4">
                <div className="mb-3">
                  <div className="d-flex justify-content-center align-items-center" style={{ fontSize: '3rem', color: '#9b59b6' }}>
                    <GiSoundWaves />
                    <IoSettingsSharp className="ms-2" />
                  </div>
                </div>
                <h3 className="mb-2">Instrument Sandbox</h3>
                <p className="text-muted mb-0">
                  Virtual Synth Designer
                </p>
                <p className="small text-muted mt-2">
                  Design and test custom instruments with oscillators, filters, and effects
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Modal.Body>
    </Modal>
  );
};

export default StudioModeSelector;
