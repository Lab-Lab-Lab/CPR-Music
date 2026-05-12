'use client';

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import Link from 'next/link';
import Card from 'react-bootstrap/Card';
import CardGroup from 'react-bootstrap/CardGroup';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { Container } from 'react-bootstrap';
import {
  FaComment,
  FaLaughBeam,
  FaMicrophone,
  FaMicrophoneAlt,
  FaTools,
  FaRulerCombined,
} from 'react-icons/fa';
import Layout from '../components/layout';

function Index() {
  return (
    <Layout>
      <h1 className="mt-3">Welcome to Music CPR</h1>
      <Row>
        <Col>
          <p>
            MusicCPR is a free platform that facilitates music teachers&apos;
            collection of individual student achievement data that aligns with
            ensemble repertoire and artistic processes (create, perform,
            respond, connect) described in National Standards for Arts
            Education.
          </p>
        </Col>
        <Col
          sm={2}
          className="d-none d-sm-flex justify-content-center align-items-center"
        >
          <FaLaughBeam size="4rem" className="text-info" />
        </Col>
      </Row>

      <Row
        className="rounded border border-3"
        style={{ borderRadius: '1rem !important' }}
      >
        <Col
          className="text-white bg-dark rounded rounded-start border"
          style={{
            borderTopLeftRadius: '1rem !important',
            borderBottomLeftRadius: '1rem !important',
          }}
        >
          <h2 className="display-6 mt-3">Students</h2>
          <ul>
            <li>Free</li>
            <li>Web App</li>
            <li>Connect with the repertoire</li>
            <li>Perform Activities for pieces assigned by your teacher</li>
            <li>Compose countermelodies</li>
            <li>Reflect on your experiences</li>
          </ul>
        </Col>
        <Col className="bg-light">
          <h2 className="display-6 mt-3">Teachers</h2>
          <ul>
            <li>Free</li>
            <li>Standards-aligned</li>
            <li>Web-based</li>
            <li>Assign activities</li>
            <li>
              Grade students&apos; work
              <ul>
                <li>give individual performance feedback</li>
                <li>export for use in other tools</li>
              </ul>
            </li>
          </ul>
        </Col>
        <Col md="6" className="">
          <h2 className="display-6 mt-3">Standards-Based Music Education</h2>
          <p>
            Teachers who provide their students with a standards-based music
            education facilitate opportunities for every student to develop
            skill and knowledge related to creating original music, performing
            their own and others' music, responding to music, and connecting in,
            around, and through music. While MusicCPR is framed through these
            four artistic processes as conceptualized in National Standards for
            Arts Education, most states have comparable policy documents that
            outline what should be part of students' P-12 music education
            experiences. MusicCPR is intended to bridge the gap between these
            policies and common practice by providing a free, research-based
            resource for any music teacher who wishes to provide their students
            opportunities to create, perform, respond, and connect through
            activities grounded in large ensemble repertoire.
          </p>
        </Col>
      </Row>
      {/* <h2 className="display-6 mt-5">Standards-Based Music Education</h2>
      <p>
        Teachers who provide their students with a standards-based music
        education facilitate opportunities for every student to develop skill
        and knowledge related to creating original music, performing their own
        and others' music, responding to music, and connecting in, around, and
        through music. While MusicCPR is framed through these four artistic
        processes as conceptualized in National Standards for Arts Education,
        most states have comparable policy documents that outline what should be
        part of students' P-12 music education experiences. MusicCPR is intended
        to bridge the gap between these policies and common practice by
        providing a free, research-based resource for any music teacher who
        wishes to provide their students opportunities to create, perform,
        respond, and connect through activities grounded in large ensemble
        repertoire.
      </p> */}
      <Row style={{ borderRadius: '1rem' }} className="mt-5 border p-3">
        <Col
          sm={2}
          className="d-flex justify-content-center align-items-center"
        >
          <FaTools size="3rem" className="text-primary" />
        </Col>
        <Col>
          <h3 className="text-primary">Individual Student Assessment Tools</h3>{' '}
          facilitate music educators&apos; in collecting data on each individual
          student&apos;s achievement relative to four artistic processes
          (create, perform, respond, connect), and to track and share their
          growth over time.
        </Col>
        {/* <Col>
          <section>
            <h2>Create</h2>
            <img
              src="screenshots/landing/Orchestra - Create.png"
              alt="Create Activity in MusicCPR"
              className="float-start"
              width="450"
            />
            <p>
              The Create Artistic Process is underrepresented in instrumental
              music education. MusicCPR scaffolds teachers who may be new to
              teaching composition in instrumental music to including it in
              their classes. Students add notes to the music score in the
              assignment's web page and then submit their countermelody along
              with a recording of them performing it.
            </p>
          </section>
        </Col> */}
      </Row>
      <Row
        style={{ borderRadius: '1rem' }}
        className="mt-5 bg-dark text-white p-3"
      >
        <Col className="text-end">
          <h3 className="text-warning">
            Valid And Reliable Assessment Rubrics
          </h3>{' '}
          provide students, teachers, parents, and other stakeholders with
          valuable information about each student's progress.
        </Col>
        <Col
          sm={2}
          className="d-flex justify-content-center align-items-center"
        >
          <FaRulerCombined size="3rem" className="text-warning" />
        </Col>
      </Row>
      <Row style={{ borderRadius: '1rem' }} className="mt-5 border p-3">
        <Col
          sm={2}
          className="d-flex justify-content-center align-items-center"
        >
          <FaTools size="3rem" className="text-info" />
        </Col>
        <Col>
          <h3 className="text-info">Perform Prompts</h3> encourage every student
          in the ensemble &emdash; regardless of the instrument they play
          &emdash; to learn important musical elements such as melodies and bass
          lines. Students will not be restricted to graduating high school music
          only having learned twelve 3rd clarinet parts; they will be able to
          play recognizable melodies and develop understanding of the bass lines
          and harmonies that underpin those themes.
        </Col>
      </Row>
      <Row
        style={{ borderRadius: '1rem' }}
        className="mt-5 bg-dark text-white p-3"
      >
        <Col className="text-end">
          <h3 className="text-danger">Create Prompts</h3> facilitate students
          creating their own original music in the context of ensemble
          repertoire they are learning to perform. Do you tell your
          administrators, parents, and other stakeholders that music is
          creative? Then consider using MusicCPR to help your students do
          something creative in music class!
        </Col>
        <Col
          sm={2}
          className="d-flex justify-content-center align-items-center"
        >
          <FaMicrophoneAlt size="3rem" className="text-danger" />
        </Col>
      </Row>
      <Row style={{ borderRadius: '1rem' }} className="my-5 border p-3">
        <Col
          sm={2}
          className="d-flex justify-content-center align-items-center"
        >
          <FaComment size="3rem" className="text-success" />
        </Col>
        <Col>
          <h3 className="text-success">Respond And Connect Prompts</h3> offer
          opportunities for students to evaluate their own performances, connect
          their experiences with those of the composer or larger cultural and
          historical contexts, and reinforce valuable literacy skills through
          organizing and sharing their reflections.
        </Col>
      </Row>
      {/* <Row>
        <Col>
          <section>
            <h2>Perform</h2>
            <img
              src="screenshots/landing/Orchestra - Melody.png"
              alt="Perform Activity in MusicCPR"
              className="float-end"
              width="450"
            />
            <p>
              In MusicCPR, students participate in the Perform Artistic Process
              through practicing and then recording their performance of both
              the melody and then in a separate activity the bassline of the
              assigned piece.
            </p>
          </section>
        </Col>
      </Row>
      <Row>
        <Col>
          <section>
            <h2>Respond</h2>
            <img
              src="screenshots/landing/Orchestra - Respond.png"
              alt="Respond Activity in MusicCPR"
              className="float-start"
              width="450"
            />
            <p>
              In MusicCPR, students participate in the Respond Artistic Process
              through reflecting on their experience with the preceding
              activities (performing the melody and bassline, and composing and
              performing their own countermelody).
            </p>
          </section>
        </Col>
      </Row>
      <Row>
        <Col>
          <section>
            <h2>Connect</h2>
            <img
              src="screenshots/landing/Orchestra - Connect - Green.png"
              alt="Connect Activity in MusicCPR"
              className="float-end"
              width="450"
            />
            <p>
              In MusicCPR, students participate in the Connect Artistic Process
              through hearing from musicians and/or composers about the piece
              they're learning and reflecting on how it relates to or contrasts
              their own lived experiences.
            </p>
          </section>
        </Col>
      </Row> */}
    </Layout>
  );
}

export default Index;
