import './style.css'

import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  collection,
  addDoc,
  // getDocs,
  getDoc,
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore'

const turnKey = import.meta.env.VITE_TURN_SERVER_KEY;
const turnPass = import.meta.env.VITE_TURN_SERVER_PASS;
const gApiKey = import.meta.env.VITE_GOOGLE_API_KEY;

const firebaseConfig = {
  apiKey: gApiKey,
  authDomain: "b68-webrtc.firebaseapp.com",
  projectId: "b68-webrtc",
  storageBucket: "b68-webrtc.appspot.com",
  messagingSenderId: "516937660662",
  appId: "1:516937660662:web:cdcbe20d5ba1bff61d54d7"
};

const firebase = initializeApp(firebaseConfig);

const db = getFirestore(firebase);


const pc = new RTCPeerConnection({
  iceServers: [
      {
        urls: "stun:a.relay.metered.ca:80",
      },
      {
        urls: "turn:a.relay.metered.ca:443",
        username: turnKey,
        credential: turnPass,
      },
      {
        urls: "turn:a.relay.metered.ca:443?transport=tcp",
        username: turnKey,
        credential: turnPass,
      },
  ],
  iceCandidatePoolSize: 10,
});

let localStream : any = null;
let remoteStream : any = null;

const webcamButton : HTMLButtonElement = document.getElementById("webcamButton") as HTMLButtonElement;
const webcamVideo : HTMLVideoElement = document.getElementById("webcamVideo") as HTMLVideoElement;
const callButton : HTMLButtonElement = document.getElementById("callButton") as HTMLButtonElement;
const callInput : HTMLInputElement = document.getElementById("callInput") as HTMLInputElement;
const answerButton : HTMLButtonElement = document.getElementById("answerButton") as HTMLButtonElement;
const remoteVideo : HTMLVideoElement = document.getElementById("remoteVideo") as HTMLVideoElement;
const hangupButton : HTMLButtonElement = document.getElementById("hangupButton") as HTMLButtonElement;

webcamButton.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    remoteStream = new MediaStream();

    localStream.getTracks().forEach((track: any) => {
        pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        });
    };
    console.log(webcamVideo.srcObject);
    webcamVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;

    callButton.disabled = false;
    answerButton.disabled = false;
    webcamButton.disabled = true;
};

callButton.onclick = async () => {
    const callDoc = await doc(collection(db, "calls"));
    const offerCandidates = collection(callDoc, "offerCandidates");
    const answerCandidates = collection(callDoc, "answerCandidates");

    callInput.value = callDoc.id;

    pc.onicecandidate = (event) => {
        event.candidate && addDoc(offerCandidates, event.candidate.toJSON());
    };

    const offerDescription = await pc.createOffer(); // creating webrtc offer
    await pc.setLocalDescription(offerDescription);

    const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
    };

    await setDoc(callDoc, { offer });

    onSnapshot(callDoc, (snapShot) => {
        const data = snapShot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
            const answerDescription = new RTCSessionDescription(data.answer);
            pc.setRemoteDescription(answerDescription);
        }
    });

    onSnapshot(answerCandidates, (snapShot) => {
        snapShot.docChanges().forEach((change) => {
            if (change.type == "added") {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });

    hangupButton.disabled = false;
};

answerButton.onclick = async () => {
    const callId = callInput.value;
    const callDoc = doc(db, "calls", callId);
    const answerCandidates = collection(callDoc, "answerCandidates");
    const offerCandidates = collection(callDoc, "offerCandidates");

    pc.onicecandidate = (event) => {
        event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
    };

    const callData : any = (await getDoc(callDoc)).data();

    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
    };

    await updateDoc(callDoc, { answer });

    onSnapshot(offerCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                let data = change.doc.data();
                pc.addIceCandidate(new RTCIceCandidate(data));
            }
        });
    });
    hangupButton.disabled = false;
};

function close() {
    webcamVideo.srcObject = null;
    remoteVideo.srcObject = null;
    pc.close();
}

hangupButton.onclick = () => {
    close();
};

pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === "disconnected") {
        close();
    }
};
