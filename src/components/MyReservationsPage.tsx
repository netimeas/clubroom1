import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import '../styles/MyReservationsPage.css';
import '../App.css'; // app-header 스타일을 위해 App.css 임포트 추가

interface UserInfo {
  studentInfo: string;
  email: string;
}

interface ReservationData {
  id: string; // Firestore 문서 ID는 필수
  teamName: string;
  useDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  reason: string;
  applicant: string;
  phoneNumber: string;
  campus: '인캠' | '경캠';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  userId: string;
  submittedAt: Date;
}

interface MyReservationsPageProps {
  onClose: () => void;
  loggedInUserInfo: UserInfo | null;
}

const MyReservationsPage: React.FC<MyReservationsPageProps> = ({ onClose, loggedInUserInfo }) => {
  const navigate = useNavigate();
  const [userReservations, setUserReservations] = useState<ReservationData[]>([]);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loggedInUserInfo || !auth.currentUser) {
      setError('로그인 정보가 없습니다. 로그인 후 다시 시도해주세요.');
      setLoading(false);
      return;
    }

    const userId = auth.currentUser.uid;
    const reservationsCollectionRef = collection(db, 'reservations');
    const q = query(reservationsCollectionRef, where('userId', '==', userId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReservations: ReservationData[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedReservations.push({
          id: doc.id,
          teamName: data.teamName,
          useDate: data.useDate,
          startTime: data.startTime,
          endTime: data.endTime,
          reason: data.reason,
          applicant: data.applicant,
          phoneNumber: data.phoneNumber,
          campus: data.campus,
          status: data.status,
          userId: data.userId,
          submittedAt: data.submittedAt ? data.submittedAt.toDate() : new Date(),
        } as ReservationData);
      });
      fetchedReservations.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
      setUserReservations(fetchedReservations);
      setLoading(false);
    }, (err) => {
      console.error('내 예약 데이터 불러오기 실패:', err);
      setError('예약 목록을 불러오는 데 실패했습니다.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loggedInUserInfo]);

  const handleReservationClick = (reservationId: string) => {
    setSelectedReservationId(prevId => (prevId === reservationId ? null : reservationId));
  };

  const handleCancelReservation = async (reservationId: string) => {
    if (window.confirm('정말로 이 예약을 취소하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, 'reservations', reservationId));
        alert('예약이 성공적으로 취소되었습니다.');
        setSelectedReservationId(null);
      } catch (error) {
        console.error('예약 취소 실패:', error);
        alert('예약 취소 중 오류가 발생했습니다.');
      }
    }
  };

  // 예약 변경 기능 제거로 인해 이 함수는 더 이상 필요 없음
  // const handleChangeReservation = (reservationId: string) => {
  //   alert(`예약 변경 기능 (ID: ${reservationId})은 현재 구현되지 않았습니다.`);
  //   // TODO: 예약 변경 페이지로 이동 로직 구현
  // };

  const formatDateTime = (useDate: string, startTime: string, endTime: string) => {
    const date = new Date(useDate);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];

    return `${month}/${day}(${dayOfWeek}) ${startTime}~${endTime}`;
  };

  const getStatusText = (status: 'pending' | 'approved' | 'rejected' | 'cancelled') => {
    switch (status) {
      case 'pending': return '승인 대기';
      case 'approved': return '승인 완료';
      case 'rejected': return '거절됨';
      case 'cancelled': return '취소됨';
      default: return '알 수 없음';
    }
  };

  if (loading) {
    return (
      <div className="my-reservations-page-container">
        <div className="my-reservations-page">
          <button className="page-close-btn" onClick={onClose}>×</button>
          <h2>내 예약</h2>
          <p>예약 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-reservations-page-container">
        <div className="my-reservations-page">
          <button className="page-close-btn" onClick={onClose}>×</button>
          <h2>내 예약</h2>
          <p className="error-message">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-reservations-page-container">
      <div className="my-reservations-page">
        <button className="page-close-btn" onClick={onClose}>×</button>
        <header className="app-header my-reservations-header">
          {/* MyReservationsPage의 헤더는 닫기 버튼과 제목만 표시 */}
        </header>
        <h2>내 예약</h2>

        {userReservations.length === 0 ? (
          <p className="no-reservations">예약된 내역이 없습니다.</p>
        ) : (
          <ul className="reservation-list">
            {userReservations.map((reservation) => (
              <li key={reservation.id} className="reservation-item">
                <div className="reservation-summary" onClick={() => handleReservationClick(reservation.id)}>
                  <span className={`campus-indicator ${reservation.campus === '인캠' ? 'incheon' : 'gyeong'}`}>
                    <span className="full-text">{reservation.campus}</span>
                    <span className="short-text">{reservation.campus === '인캠' ? '인' : '경'}</span>
                  </span>
                  <span className="reservation-datetime">
                    {formatDateTime(reservation.useDate, reservation.startTime, reservation.endTime)}
                  </span>
                  <span className={`reservation-status ${reservation.status}`}>
                    {getStatusText(reservation.status)}
                  </span>
                </div>
                {selectedReservationId === reservation.id && (
                  <div className="reservation-actions">
                    {/* '예약 변경' 버튼 제거 */}
                    {/* <button
                      className="action-button change-button"
                      onClick={() => handleChangeReservation(reservation.id)}
                    >
                      예약 변경
                    </button> */}
                    <button
                      className="action-button cancel-button"
                      onClick={() => handleCancelReservation(reservation.id)}
                    >
                      예약 취소
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MyReservationsPage;
