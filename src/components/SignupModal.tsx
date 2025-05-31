import React, { useState } from 'react';
import '../styles/Modal.css'; // Modal.css를 사용하도록 변경

// 회원가입 모달 컴포넌트 정의
interface SignupModalProps {
  onClose: () => void;
  onSignupSubmit: (studentInfo: string, email: string, password: string) => Promise<void>;
  onShowLogin: () => void; // 로그인 모달을 보여주기 위한 콜백
}

const SignupModal: React.FC<SignupModalProps> = ({ onClose, onSignupSubmit, onShowLogin }) => {
  const [studentInfo, setStudentInfo] = useState(''); // 학번+이름
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 학번+이름 형식 유효성 검사 (예: 23 홍길동)
  const validateStudentInfo = (info: string): boolean => {
    const regex = /^\d{2}\s[가-힣a-zA-Z]+$/; // 'XX 이름' 형식 (예: 23 홍길동, 01 김철수)
    return regex.test(info);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 클라이언트 측 유효성 검사
    if (!validateStudentInfo(studentInfo)) {
      alert('학번+이름 형식이 올바르지 않습니다. (예: 23 홍길동)');
      return;
    }
    if (!email.includes('@')) { // 간단한 이메일 형식 검사 (더 강력한 정규식 사용 가능)
      alert('유효한 이메일 주소를 입력해주세요.');
      return;
    }
    if (password.length < 6) { // Firebase 기본 최소 비밀번호 길이
      alert('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }
    if (password !== confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    // 모든 유효성 검사를 통과하면 상위 컴포넌트로 데이터 전달
    await onSignupSubmit(studentInfo, email, password);
  };

  const handleLoginClick = () => {
    onShowLogin(); // 로그인 모달 표시 콜백 호출
  };

  return (
    <div className="modal-overlay"> {/* signup-modal-overlay -> modal-overlay */}
      <div className="modal-content"> {/* signup-modal -> modal-content */}
        {/* 새로운 X 버튼 추가 */}
        <button className="modal-close-x-btn" onClick={onClose}>×</button>
        <h2>회원가입</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="studentInfo">학번+이름 (예: 23 홍길동):</label>
            <input
              type="text"
              id="studentInfo"
              value={studentInfo}
              onChange={(e) => setStudentInfo(e.target.value)}
              placeholder="예: 23 홍길동"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="signupEmail">이메일:</label>
            <input
              type="email"
              id="signupEmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="signupPassword">비밀번호:</label>
            <input
              type="password"
              id="signupPassword"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">비밀번호 확인:</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="modal-signup-btn">회원가입</button>
        </form>
        <div className="modal-footer">
          <p>이미 계정이 있으신가요? <button type="button" className="login-link-btn" onClick={handleLoginClick}>로그인</button></p>
        </div>
      </div>
    </div>
  );
};

export default SignupModal;
