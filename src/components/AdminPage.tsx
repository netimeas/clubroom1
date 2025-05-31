import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import '../styles/AdminPage.css'; // 관리자 페이지 전용 CSS

// 하위 관리자 페이지 컴포넌트 임포트
import AdminReservationManagement from './AdminReservationManagement';
import AdminUserManagement from './AdminUserManagement';
import AdminUnavailableSchedule from './AdminUnavailableSchedule';

// UserInfo 인터페이스를 export 합니다.
export interface UserInfo {
  uid?: string; // UID 필드 추가 (Firestore 문서 ID)
  studentInfo: string;
  email: string;
  role?: string;
}

interface ReservationData {
  id: string;
  teamName: string;
  useDate: string;
  startTime: string;
  endTime: string;
  reason: string;
  applicant: string;
  phoneNumber: string;
  campus: '인캠' | '경캠';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  userId: string;
  submittedAt: Date;
}

interface AdminPageProps {
  loggedInUserInfo: UserInfo | null;
  onLogout: () => void; // 로그아웃 핸들러 추가
}

const AdminPage: React.FC<AdminPageProps> = ({ loggedInUserInfo, onLogout }) => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState<'reservation' | 'user' | 'unavailable'>(
    'reservation'
  ); // 현재 관리 페이지 상태

  useEffect(() => {
    // 관리자 권한이 없으면 메인 페이지로 리다이렉트
    if (!loggedInUserInfo || loggedInUserInfo.role !== 'admin') {
      alert('관리자 권한이 없습니다.');
      navigate('/');
    }
  }, [loggedInUserInfo, navigate]);

  if (!loggedInUserInfo || loggedInUserInfo.role !== 'admin') {
    return null; // 권한이 없으면 아무것도 렌더링하지 않음
  }

  return (
    <div className="admin-page-container">
      <header className="admin-header">
        <h1 className="admin-title">관리자 페이지</h1>
        <div className="admin-header-buttons"> {/* 버튼들을 묶는 div 추가 */}
          <button className="admin-main-page-btn" onClick={() => navigate('/')}>
            메인 페이지로
          </button>
          <button className="admin-logout-btn" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      </header>

      <nav className="admin-nav">
        <button
          className={`admin-nav-btn ${
            currentPage === 'reservation' ? 'active' : ''
          }`}
          onClick={() => setCurrentPage('reservation')}
        >
          예약 일정 관리
        </button>
        <button
          className={`admin-nav-btn ${currentPage === 'user' ? 'active' : ''}`}
          onClick={() => setCurrentPage('user')}
        >
          회원 관리
        </button>
        <button
          className={`admin-nav-btn ${
            currentPage === 'unavailable' ? 'active' : ''
          }`}
          onClick={() => setCurrentPage('unavailable')}
        >
          예약 불가<br />일정 관리
        </button>
      </nav>

      <div className="admin-content">
        {currentPage === 'reservation' && (
          <AdminReservationManagement loggedInUserInfo={loggedInUserInfo} />
        )}
        {currentPage === 'user' && (
          <AdminUserManagement loggedInUserInfo={loggedInUserInfo} />
        )}
        {currentPage === 'unavailable' && (
          <AdminUnavailableSchedule loggedInUserInfo={loggedInUserInfo} />
        )}
      </div>
    </div>
  );
};

export default AdminPage;
