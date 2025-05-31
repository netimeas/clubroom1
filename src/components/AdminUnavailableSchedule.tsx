import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, onSnapshot, doc, deleteDoc, query, orderBy } from 'firebase/firestore'; // Firestore 추가 및 쿼리 임포트
import { db } from '../firebaseConfig'; // db 임포트
import AddUnavailableScheduleModal from './AddUnavailableScheduleModal'; // 모달 컴포넌트 임포트

// AdminPage.tsx에 이미 AdminPage.css가 임포트되어 있으므로 이 파일에서는 별도 임포트 안 함

interface UserInfo {
  studentInfo: string;
  email: string;
  role?: string;
}

interface UnavailableScheduleData {
  id?: string; // Firestore 문서 ID는 선택적이지만, 여기서는 필수적으로 사용
  reason: string;
  campus: '인캠' | '경캠' | '';
  startDate: string; //YYYY-MM-DD
  endDate: string;   //YYYY-MM-DD
  frequencyType: 'once' | 'weekly' | 'monthly_by_week_day' | '';
  dayOfWeek?: number; // 0 (일요일) - 6 (토요일)
  weekOfMonth?: number; // 1 (첫째 주) - 4 (넷째 주), 5 (마지막 주)
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  createdAt?: Date; // Firestore Timestamp
}

interface AdminUnavailableScheduleProps {
  loggedInUserInfo: UserInfo | null;
}

const AdminUnavailableSchedule: React.FC<AdminUnavailableScheduleProps> = ({ loggedInUserInfo }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [unavailableSchedules, setUnavailableSchedules] = useState<UnavailableScheduleData[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<UnavailableScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'unavailableSchedules'),
      orderBy('createdAt', 'desc') // 최신순 정렬
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSchedules: UnavailableScheduleData[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedSchedules.push({
          id: doc.id,
          reason: data.reason,
          campus: data.campus,
          startDate: data.startDate,
          endDate: data.endDate,
          frequencyType: data.frequencyType,
          dayOfWeek: data.dayOfWeek,
          weekOfMonth: data.weekOfMonth,
          startTime: data.startTime,
          endTime: data.endTime,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
        } as UnavailableScheduleData);
      });
      setUnavailableSchedules(fetchedSchedules);
      setLoading(false);
    }, (err) => {
      console.error('예약 불가 일정 불러오기 실패:', err);
      setError('예약 불가 일정을 불러오는 데 실패했습니다.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddUnavailableSchedule = async (data: UnavailableScheduleData) => {
    try {
      await addDoc(collection(db, 'unavailableSchedules'), {
        ...data,
        createdAt: serverTimestamp(), // 서버 타임스탬프 추가
      });
      alert('예약 불가 일정이 성공적으로 추가되었습니다.');
    } catch (error) {
      console.error('예약 불가 일정 추가 실패:', error);
      alert('예약 불가 일정 추가 중 오류가 발생했습니다.');
    }
  };

  const handleScheduleClick = (schedule: UnavailableScheduleData) => {
    setSelectedSchedule(prev => (prev?.id === schedule.id ? null : schedule));
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!window.confirm('이 예약 불가 일정을 삭제하시겠습니까?')) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'unavailableSchedules', scheduleId));
      alert('예약 불가 일정이 성공적으로 삭제되었습니다.');
      setSelectedSchedule(null); // 삭제 후 선택 해제
    } catch (error) {
      console.error('예약 불가 일정 삭제 실패:', error);
      alert('예약 불가 일정 삭제 중 오류가 발생했습니다.');
    }
  };

  // 예약 불가 일정 표시를 위한 포맷팅 함수
  const formatScheduleDisplay = (schedule: UnavailableScheduleData) => {
    const dayOfWeekNames = ['일', '월', '화', '수', '목', '금', '토'];
    const weekOfMonthNames = ['첫째', '둘째', '셋째', '넷째', '마지막'];

    let frequencyText = '';
    if (schedule.frequencyType === 'once') {
      frequencyText = `1회성`;
    } else if (schedule.frequencyType === 'weekly') {
      frequencyText = `매주 ${schedule.dayOfWeek !== undefined ? dayOfWeekNames[schedule.dayOfWeek] : ''}요일`;
    } else if (schedule.frequencyType === 'monthly_by_week_day') {
      frequencyText = `매달 ${schedule.weekOfMonth !== undefined ? weekOfMonthNames[schedule.weekOfMonth - 1] : ''}주 ${schedule.dayOfWeek !== undefined ? dayOfWeekNames[schedule.dayOfWeek] : ''}요일`;
    }

    return (
      <>
        <span className="schedule-reason">{schedule.reason}</span>
        <span className="schedule-period">기간: {schedule.startDate} ~ {schedule.endDate}</span>
        <span className="schedule-frequency">빈도: {frequencyText}</span>
        <span className="schedule-time">시간: {schedule.startTime} ~ {schedule.endTime}</span>
      </>
    );
  };

  if (loading) {
    return <div className="admin-section-loading">예약 불가 일정을 불러오는 중...</div>;
  }

  if (error) {
    return <div className="admin-section-error">{error}</div>;
  }

  return (
    <div className="admin-unavailable-schedule">
      <h2 className="admin-section-title">예약 불가 일정 관리</h2>

      <div className="unavailable-schedule-list-container">
        {unavailableSchedules.length === 0 ? (
          <p className="no-unavailable-schedules">등록된 예약 불가 일정이 없습니다.</p>
        ) : (
          <ul className="unavailable-schedule-list">
            {unavailableSchedules.map((schedule) => (
              <li
                key={schedule.id}
                className={`unavailable-schedule-item ${selectedSchedule?.id === schedule.id ? 'selected' : ''}`}
                onClick={() => handleScheduleClick(schedule)}
              >
                <span className={`campus-label ${schedule.campus === '인캠' ? 'incheon' : 'gyeong'}`}>
                  {schedule.campus}
                </span>
                <div className="schedule-info">
                  {formatScheduleDisplay(schedule)}
                </div>
                {selectedSchedule?.id === schedule.id && (
                  <button
                    className="delete-schedule-btn"
                    onClick={(e) => {
                      e.stopPropagation(); // 부모 li의 클릭 이벤트 방지
                      if (schedule.id) {
                        handleDeleteSchedule(schedule.id);
                      }
                    }}
                  >
                    일정 삭제
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button className="add-unavailable-btn" onClick={() => setShowAddModal(true)}>
        +
      </button>

      {showAddModal && (
        <AddUnavailableScheduleModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddUnavailableSchedule}
        />
      )}
    </div>
  );
};

export default AdminUnavailableSchedule;
