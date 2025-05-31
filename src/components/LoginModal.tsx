import React, { useState } from 'react';
import '../styles/Modal.css'; // Modal.css를 사용하도록 변경

interface LoginModalProps {
  onClose: () => void;
  onLoginSubmit: (email: string, password: string) => Promise<void>;
  onShowSignup: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose, onLoginSubmit, onShowSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false); // 자동 로그인 상태

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onLoginSubmit(email, password);
    // 로그인 성공/실패는 App.tsx에서 처리
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {/* 새로운 X 버튼 추가 */}
        <button className="modal-close-x-btn" onClick={onClose}>×</button>
        <h2>로그인</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">이메일</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* 자동 로그인 체크박스 그룹: form-group 클래스 제거 */}
          <div className="remember-me-group">
            {/* 체크박스를 먼저, 그 다음에 라벨 */}
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="remember-me-checkbox"
            />
            <label htmlFor="rememberMe" className="remember-me-label">자동 로그인</label>
          </div>

          <button type="submit" className="modal-login-btn">로그인</button>
        </form>
        <div className="modal-footer">
          <p>계정이 없으신가요? <button type="button" className="signup-link-btn" onClick={onShowSignup}>회원가입</button></p>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
