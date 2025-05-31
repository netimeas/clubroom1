import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
// import '../styles/AdminReservationManagement.css'; // 이 줄을 제거합니다.

interface UserInfo {
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

interface AdminReservationManagementProps {
  loggedInUserInfo: UserInfo | null;
}

const AdminReservationManagement: React.FC<AdminReservationManagementProps> = ({ loggedInUserInfo }) => {
  const [pendingReservations, setPendingReservations] = useState<ReservationData[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<ReservationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 'pending' 상태의 예약만 가져오기
    const q = query(
      collection(db, 'reservations'),
      where('status', '==', 'pending')
    );

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
      // 최신 예약 순으로 정렬 (신청일 기준 내림차순)
      fetchedReservations.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
      setPendingReservations(fetchedReservations);
      setLoading(false);
    }, (err) => {
      console.error('승인 대기 예약 불러오기 실패:', err);
      setError('승인 대기 예약을 불러오는 데 실패했습니다.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleReservationClick = (reservation: ReservationData) => {
    setSelectedReservation(prev => (prev?.id === reservation.id ? null : reservation));
  };

  const handleApproveReservation = async (reservationId: string) => {
    if (!window.confirm('이 예약을 승인하시겠습니까?')) { // confirm 대신 커스텀 모달 사용 권장
      return;
    }
    try {
      const reservationRef = doc(db, 'reservations', reservationId);
      await updateDoc(reservationRef, {
        status: 'approved',
      });
      alert('예약이 승인되었습니다.');
      setSelectedReservation(null); // 승인 후 상세 정보 닫기
    } catch (error) {
      console.error('예약 승인 실패:', error);
      alert('예약 승인 중 오류가 발생했습니다.');
    }
  };

  // 날짜 및 요일 형식화 함수 (줄바꿈 포함)
  const formatDateTimeForDisplay = (useDate: string, startTime: string, endTime: string) => {
    const date = new Date(useDate);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];

    return (
      <>
        {month}/{day}({dayOfWeek})<br />
        {startTime}~{endTime}
      </>
    );
  };

  if (loading) {
    return <div className="admin-section-loading">예약 목록을 불러오는 중...</div>;
  }

  if (error) {
    return <div className="admin-section-error">{error}</div>;
  }

  return (
    <div className="admin-reservation-management">
      <h2 className="admin-section-title">예약 일정 관리</h2>
      <div className="reservation-list-container">
        {pendingReservations.length === 0 ? (
          <p className="no-pending-reservations">승인 대기 중인 예약이 없습니다.</p>
        ) : (
          <ul className="pending-reservation-list">
            {pendingReservations.map((reservation) => (
              <li
                key={reservation.id}
                className={`pending-reservation-item ${selectedReservation?.id === reservation.id ? 'selected' : ''}`}
                onClick={() => handleReservationClick(reservation)}
              >
                <span className={`campus-label ${reservation.campus === '인캠' ? 'incheon' : 'gyeong'}`}>
                  {reservation.campus}
                </span>
                <span className="reservation-time-display">
                  {formatDateTimeForDisplay(reservation.useDate, reservation.startTime, reservation.endTime)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedReservation && (
        <div className="reservation-detail-card">
          <h3>예약 상세 정보</h3>
          <p><strong>1. 팀명:</strong> {selectedReservation.teamName}</p>
          <p><strong>3. 사유:</strong> {selectedReservation.reason}</p>
          <p><strong>4. 신청자:</strong> {selectedReservation.applicant}<br />
             <strong>번호:</strong> {selectedReservation.phoneNumber}</p> {/* 줄바꿈 및 번호 포함 */}
          <div className="detail-actions">
            <button
              className="approve-btn"
              onClick={() => handleApproveReservation(selectedReservation.id)}
            >
              예약 승인
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReservationManagement;
