import React from 'react';
import '../styles/ReservationDetailsModal.css'; // 모달 스타일 시트

// ReservationData 인터페이스 (App.tsx와 동일하게 유지)
interface ReservationData {
  id?: string;
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

// UnavailableScheduleData 인터페이스 (App.tsx와 동일하게 유지)
interface UnavailableScheduleData {
  id?: string;
  reason: string;
  campus: '인캠' | '경캠' | '';
  startDate: string;
  endDate: string;
  frequencyType: 'once' | 'weekly' | 'monthly_by_week_day' | '';
  dayOfWeek?: number; // 0 (일요일) - 6 (토요일)
  weekOfMonth?: number; // 1 (첫째 주) - 4 (넷째 주), 5 (마지막 주)
  startTime: string;
  endTime: string;
  createdAt?: Date;
}

// 모달 Props 인터페이스 정의
interface ReservationDetailsModalProps {
  data: ReservationData | UnavailableScheduleData | null; // 예약 또는 예약 불가 데이터
  dataType: 'reservation' | 'unavailable' | null; // 데이터 타입 구분
  onClose: () => void;
}

const ReservationDetailsModal: React.FC<ReservationDetailsModalProps> = ({ data, dataType, onClose }) => {
  if (!data) return null; // 데이터가 없으면 렌더링하지 않음

  const dayOfWeekNames = ['일', '월', '화', '수', '목', '금', '토'];
  const weekOfMonthNames = ['첫째', '둘째', '셋째', '넷째', '마지막'];

  const isReservation = dataType === 'reservation';
  const isUnavailable = dataType === 'unavailable';

  // 빈도 타입에 따른 텍스트 포맷팅 헬퍼 함수
  const formatFrequency = (schedule: UnavailableScheduleData) => {
    if (schedule.frequencyType === 'once') {
      return '1회성';
    } else if (schedule.frequencyType === 'weekly') {
      return `매주 ${schedule.dayOfWeek !== undefined ? dayOfWeekNames[schedule.dayOfWeek] : ''}요일`;
    } else if (schedule.frequencyType === 'monthly_by_week_day') {
      return `매달 ${schedule.weekOfMonth !== undefined ? weekOfMonthNames[schedule.weekOfMonth - 1] : ''}주 ${schedule.dayOfWeek !== undefined ? dayOfWeekNames[schedule.dayOfWeek] : ''}요일`;
    }
    return '';
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {/* 상단 'X' 버튼 제거 */}

        {isReservation && (
          <>
            <h2>예약 상세 정보</h2>
            <p><strong>1. 팀명:</strong> {(data as ReservationData).teamName}</p>
            <p><strong>2. 사용 일시:</strong> {new Date((data as ReservationData).useDate).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })} {(data as ReservationData).startTime}~{(data as ReservationData).endTime}</p>
            <p><strong>3. 사유:</strong> {(data as ReservationData).reason}</p>
            <p><strong>4. 신청자:</strong> {(data as ReservationData).applicant}</p>
            <div className="modal-actions">
              <button className="confirm-btn" onClick={onClose}>확인</button>
            </div>
          </>
        )}

        {isUnavailable && (
          <>
            <h2>이용 불가 상세 정보</h2>
            <p><strong>사유:</strong> {(data as UnavailableScheduleData).reason}</p>
            <p><strong>빈도:</strong> {formatFrequency(data as UnavailableScheduleData)}</p>
            <p><strong>시간:</strong> {(data as UnavailableScheduleData).startTime} ~ {(data as UnavailableScheduleData).endTime}</p>
            <div className="modal-actions">
              <button className="confirm-btn" onClick={onClose}>확인</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReservationDetailsModal;
