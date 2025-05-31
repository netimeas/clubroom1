// src/firebaseConfig.ts
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// 사용할 Firebase 서비스들을 추가로 import
import { getAuth } from "firebase/auth"; // Firebase Authentication을 위해 추가
import { getFirestore } from "firebase/firestore"; // Firebase Firestore를 위해 추가

// Your web app's Firebase configuration (이 부분은 실제 키로 변경)
const firebaseConfig = {
  apiKey: "AIzaSyB6mGBnRGHzXtUaPXKR1v_P5ekbcKmmCEs",
  authDomain: "club-room-gemini.firebaseapp.com",
  projectId: "club-room-gemini",
  storageBucket: "club-room-gemini.firebasestorage.app",
  messagingSenderId: "793865097610",
  appId: "1:793865097610:web:b16b51209ff9aff0f23873"
};

// Initialize Firebase 앱
const app = initializeApp(firebaseConfig);

// 각 Firebase 서비스를 초기화하고 export (다른 파일에서 import해서 사용할 수 있도록)
export const auth = getAuth(app); // 인증 서비스
export const db = getFirestore(app); // Firestore 데이터베이스 서비스

// 필요하다면 다른 서비스들도 추가로 export 할 수 있습니다.
// import { getStorage } from "firebase/storage";
// export const storage = getStorage(app);