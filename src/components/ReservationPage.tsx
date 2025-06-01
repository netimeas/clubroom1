// ReservationPage.tsx 파일
import React, { useState, useEffect, useRef } from 'react';
import '../styles/ReservationPage.css';
import '../App.css'; // app-header 스타일을 위해 App.css 임포트 추가

interface UserInfo {
  studentInfo: string;
  email: string;
}

interface ReservationData {
  id?: string; // Firestore 문서 ID를 위한 선택적 필드
  teamName: string;
  useDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  reason: string;
  applicant: string;
  phoneNumber: string;
  campus: '인캠' | '경캠';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'; // 예약 상태 필드 추가
  userId: string; // 예약한 사용자 UID
  submittedAt: Date; // 예약 신청 시간
}

interface ReservationPageProps {
  onClose: () => void;
  selectedDate: Date;
  initialStartTime?: string;
  initialEndTime?: string;
  loggedInUserInfo: { studentInfo: string; email: string; } | null;
  selectedCampus: '인캠' | '경캠';
  onSubmitReservation: (reservationData: ReservationData) => Promise<void>; // Changed to Promise<void>
  handleCampusClick: () => void;
  // 👇 이 부분을 추가합니다.
  currentDayReservations: ReservationData[];
}

const teamOptions = ['동아팀', '아리팀', '기타'];
const reasonOptions = ['동아리 활동', '동아리 모임', '기타'];

const ReservationPage: React.FC<ReservationPageProps> = ({
  onClose,
  selectedDate,
  initialStartTime,
  initialEndTime,
  loggedInUserInfo,
  selectedCampus,
  onSubmitReservation,
  handleCampusClick,
  // 👇 prop으로 받도록 추가
  currentDayReservations,
}) => {
  const [teamName, setTeamName] = useState<string>('');
  const [isTeamNameOther, setIsTeamNameOther] = useState(false);
  const [otherTeamName, setOtherTeamName] = useState('');

  const [startTimeHour, setStartTimeHour] = useState<string>('00');
  const [startTimeMinute, setStartTimeMinute] = useState<string>('00');
  const [endTimeHour, setEndTimeHour] = useState<string>('00');
  const [endTimeMinute, setEndTimeMinute] = useState<string>('00');

  const [reason, setReason] = useState<string>('');
  const [isReasonOther, setIsReasonOther] = useState(false);
  const [otherReason, setOtherReason] = useState('');

  const [applicant, setApplicant] = useState(loggedInUserInfo?.studentInfo || '');
  const [isApplicantDefault, setIsApplicantDefault] = useState(true); // 기본값 여부를 추적
  const [phoneNumber, setPhoneNumber] = useState(''); // 초기값 빈 문자열로 유지

  const phoneNumberRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialStartTime && initialEndTime) {
      const [startH, startM] = initialStartTime.split(':');
      const [endH, endM] = initialEndTime.split(':');
      setStartTimeHour(startH);
      setStartTimeMinute(startM);
      setEndTimeHour(endH);
      setEndTimeMinute(endM);
    } else {
      setStartTimeHour('00');
      setStartTimeMinute('00');
      setEndTimeHour('00');
      setEndTimeMinute('00');
    }
    setApplicant(loggedInUserInfo?.studentInfo || '');
    setIsApplicantDefault(true); // 초기값 설정 시 기본값으로 표시
  }, [initialStartTime, initialEndTime, loggedInUserInfo]);


  const formattedDate = selectedDate.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const handleTeamNameChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setTeamName(value);
    setIsTeamNameOther(value === '기타');
    if (value !== '기타') {
      setOtherTeamName('');
    }
  };

  const handleReasonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setReason(value);
    setIsReasonOther(value === '기타');
    if (value !== '기타') {
      setOtherReason('');
    }
  };

  const handleApplicantChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setApplicant(value);
    // 사용자가 입력을 시작하면 기본값이 아닌 것으로 처리
    setIsApplicantDefault(value === loggedInUserInfo?.studentInfo);
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filteredValue = e.target.value.replace(/[^0-9-]/g, '');
    setPhoneNumber(filteredValue);
  };

  const handlePhoneNumberFocus = () => {
    // 아무것도 하지 않음 (기본값 설정 제거)
  };

  // 👇 새로운 헬퍼 함수: 두 시간 범위가 겹치는지 확인
  const isTimeOverlap = (start1: string, end1: string, start2: string, end2: string) => {
    const s1Min = parseInt(start1.split(':')[0]) * 60 + parseInt(start1.split(':')[1]);
    const e1Min = parseInt(end1.split(':')[0]) * 60 + parseInt(end1.split(':')[1]);
    const s2Min = parseInt(start2.split(':')[0]) * 60 + parseInt(start2.split(':')[1]);
    const e2Min = parseInt(end2.split(':')[0]) * 60 + parseInt(end2.split(':')[1]);

    // 두 구간이 겹치는 조건: (A의 시작 < B의 끝) AND (A의 끝 > B의 시작)
    return s1Min < e2Min && e1Min > s2Min;
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalTeamName = isTeamNameOther ? otherTeamName : teamName;
    const finalReason = isReasonOther ? otherReason : reason;

    if (!finalTeamName) {
      alert('팀명을 입력해주세요.');
      return;
    }
    if (!startTimeHour || !startTimeMinute || !endTimeHour || !endTimeMinute) {
      alert('사용 시간을 입력해주세요.');
      return;
    }
    if (!finalReason) {
      alert('사유를 입력해주세요.');
      return;
    }
    if (!applicant) {
      alert('신청자 정보를 입력해주세요.');
      return;
    }
    const phoneRegex = /^(010-\d{4}-\d{4}|010\d{8})$/;
    if (!phoneNumber || !phoneRegex.test(phoneNumber)) {
      alert('유효한 전화번호 (예: 010-1234-5678 또는 01012345678)를 입력해주세요.');
      return;
    }

    const startH = parseInt(startTimeHour);
    const startM = parseInt(startTimeMinute);
    const endH = parseInt(endTimeHour);
    const endM = parseInt(endTimeMinute);

    if (startH < 0 || startH > 23 || (startM !== 0 && startM !== 30)) {
        alert('시작 시간의 형식이나 범위가 올바르지 않습니다. (예: 08:00 또는 08:30)');
        return;
    }
    if (endH < 0 || endH > 23 || (endM !== 0 && endM !== 30)) {
        alert('종료 시간의 형식이나 범위가 올바르지 않습니다. (예: 10:00 또는 10:30)');
        return;
    }

    if (startH * 60 + startM >= endH * 60 + endM) {
        alert('종료 시간은 시작 시간보다 늦어야 합니다.');
        return;
    }

    // 👇 예약 겹침 검사 로직 추가
    const newReservationStartTime = `${startTimeHour}:${startTimeMinute}`;
    const newReservationEndTime = `${endTimeHour}:${endTimeMinute}`;

    const isOverlapWithExisting = currentDayReservations.some(existingRes => {
      // 'pending', 'approved' 상태의 예약과 겹치는지 확인
      const isConsideredOccupied = existingRes.status === 'pending' || existingRes.status === 'approved';
      
      if (isConsideredOccupied) {
        return isTimeOverlap(
          newReservationStartTime,
          newReservationEndTime,
          existingRes.startTime,
          existingRes.endTime
        );
      }
      return false;
    });

    if (isOverlapWithExisting) {
      alert('선택하신 시간은 이미 예약 중이거나 승인 대기 중인 다른 예약과 겹칩니다. 예약할 수 없는 시간대입니다.');
      return; // 예약 신청 중단
    }

    // 날짜를 "YYYY-MM-DD" 형식으로 직접 포매팅
    const year = selectedDate.getFullYear();
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0'); // 월은 0부터 시작하므로 +1
    const day = selectedDate.getDate().toString().padStart(2, '0');
    const formattedUseDate = `${year}-${month}-${day}`;

    const reservationData: ReservationData = {
      teamName: finalTeamName,
      useDate: formattedUseDate, // 변경된 부분
      startTime: `${startTimeHour}:${startTimeMinute}`,
      endTime: `${endTimeHour}:${endTimeMinute}`,
      reason: finalReason,
      applicant,
      phoneNumber,
      campus: selectedCampus,
      status: 'pending', // Default status for new reservations
      userId: loggedInUserInfo?.email || 'unknown', // Placeholder, ideally use actual UID
      submittedAt: new Date(),
    };

    await onSubmitReservation(reservationData);
    onClose();
  };

  return (
    <div className="reservation-page-container">
      <div className="reservation-page">
        <button className="page-close-btn" onClick={onClose}>×</button>
        <header className="app-header reservation-page-header">
          <div className="campus-selection">
            <button
              className={`campus-btn ${selectedCampus === '인캠' ? 'active-incheon' : 'inactive-gyeong'}`}
              onClick={handleCampusClick}
            >
              인캠
            </button>
            <button
              className={`campus-btn ${selectedCampus === '경캠' ? 'active-gyeong' : 'inactive-incheon'}`}
              onClick={handleCampusClick}
            >
              경캠
            </button>
          </div>
        </header>

        <h2>예약하기</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="teamName">1. 팀명</label>
            <div className="custom-select-wrapper">
              <select
                id="teamName"
                value={isTeamNameOther ? '기타' : teamName}
                onChange={handleTeamNameChange}
              >
                <option value="">선택하세요</option>
                {teamOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            {isTeamNameOther && (
                <input
                  type="text"
                  className="other-input"
                  value={otherTeamName}
                  onChange={(e) => setOtherTeamName(e.target.value)}
                  placeholder="직접 입력"
                  required
                />
              )}
          </div>

          <div className="form-group">
            <label>2. 사용 일시 <span className="highlight-date">{formattedDate}</span></label>
            <div className="time-input-group">
              <input
                type="number"
                inputMode="numeric"
                value={startTimeHour}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(23, parseInt(e.target.value) || 0)).toString().padStart(2, '0');
                  setStartTimeHour(val);
                }}
                min="00"
                max="23"
                placeholder="HH"
                maxLength={2}
                required
              />
              <span>:</span>
              <select
                value={startTimeMinute}
                onChange={(e) => setStartTimeMinute(e.target.value)}
                required
              >
                <option value="00">00</option>
                <option value="30">30</option>
              </select>
              <span> ~ </span>
              <input
                type="number"
                inputMode="numeric"
                value={endTimeHour}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(23, parseInt(e.target.value) || 0)).toString().padStart(2, '0');
                  setEndTimeHour(val);
                }}
                min="00"
                max="23"
                placeholder="HH"
                maxLength={2}
                required
              />
              <span>:</span>
              <select
                value={endTimeMinute}
                onChange={(e) => setEndTimeMinute(e.target.value)}
                required
              >
                <option value="00">00</option>
                <option value="30">30</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reason">3. 사유</label>
            <div className="custom-select-wrapper">
              <select
                id="reason"
                value={isReasonOther ? '기타' : reason}
                onChange={handleReasonChange}
              >
                <option value="">선택하세요</option>
                {reasonOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            {isReasonOther && (
                <input
                  type="text"
                  className="other-input"
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="직접 입력"
                  required
                />
              )}
          </div>

          <div className="form-group">
            <label htmlFor="applicant">4. 신청자 / 번호</label>
            <input
              type="text"
              id="applicant"
              className={`applicant-info-input ${isApplicantDefault ? 'default-value' : ''}`}
              value={applicant}
              onChange={handleApplicantChange}
              placeholder="내 학번 + 이름"
              required
            />
            <input
              type="tel"
              inputMode="numeric"
              value={phoneNumber}
              onChange={handlePhoneNumberChange}
              onFocus={handlePhoneNumberFocus}
              placeholder="010-1234-5678 or 01012345678"
              maxLength={13}
              ref={phoneNumberRef}
              required
            />
          </div>

          <button type="submit" className="submit-reservation-btn">예약 신청</button>
        </form>
      </div>
    </div>
  );
};

export default ReservationPage;
