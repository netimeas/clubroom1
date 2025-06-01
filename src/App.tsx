// App.tsx
import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import LoginModal from './components/LoginModal';
import SignupModal from './components/SignupModal';
import ReservationPage from './components/ReservationPage';
import MyReservationsPage from './components/MyReservationsPage';
import ReservationDetailsModal from './components/ReservationDetailsModal';
import AdminPage from './components/AdminPage'; // AdminPage 임포트

import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

import { auth, db } from './firebaseConfig';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, where, orderBy } from "firebase/firestore";

interface UserInfo {
  studentInfo: string;
  email: string;
  role?: string; // role 필드 추가
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

interface UnavailableScheduleData {
  id?: string;
  reason: string;
  campus: '인캠' | '경캠' | '';
  startDate: string; //YYYY-MM-DD
  endDate: string;   //YYYY-MM-DD
  frequencyType: 'once' | 'weekly' | 'monthly_by_week_day' | '';
  dayOfWeek?: number; // 0 (일요일) - 6 (토요일)
  weekOfMonth?: number; // 1 (첫째 주) - 4 (넷째 주), 5 (마지막 주)
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  createdAt?: Date;
}

// MainContent 컴포넌트의 props 인터페이스에 navigate 및 handleOpenDetailsModal 추가
const MainContent: React.FC<{
  selectedCampus: '인캠' | '경캠';
  handleCampusClick: () => void;
  isLoggedIn: boolean;
  loggedInUserInfo: UserInfo | null;
  isLogoutConfirmMode: boolean;
  handleLoginButtonClick: () => Promise<void>;
  loginButtonRef: React.RefObject<HTMLButtonElement | null>;
  displayYear: number;
  displayMonth: number;
  selectedDate: Date;
  handleTodayClick: () => void;
  handlePrevMonthClick: () => void;
  handleNextMonthClick: () => void;
  handleDateClick: (date: number) => void;
  handleSlotClick: (status: string, index: number) => void;
  handleOpenReservationPage: (initialStart?: string, initialEnd?: string) => void;
  requireLogin: () => void;
  currentDayReservations: ReservationData[];
  unavailableSchedules: UnavailableScheduleData[]; // 추가: 예약 불가 일정 데이터
  navigate: (path: string) => void;
  handleOpenDetailsModal: (item: ReservationData | UnavailableScheduleData, type: 'reservation' | 'unavailable') => void; // 새로운 prop 추가
  isLoading: boolean; // 추가: 로딩 상태
}> = ({
  selectedCampus,
  handleCampusClick,
  isLoggedIn,
  loggedInUserInfo,
  isLogoutConfirmMode,
  handleLoginButtonClick,
  loginButtonRef,
  displayYear,
  displayMonth,
  selectedDate,
  handleTodayClick,
  handlePrevMonthClick,
  handleNextMonthClick,
  handleDateClick,
  handleSlotClick,
  handleOpenReservationPage,
  requireLogin,
  currentDayReservations,
  unavailableSchedules, // 추가: 예약 불가 일정 데이터 받기
  navigate,
  handleOpenDetailsModal, // 새로운 prop 구조 분해 할당
  isLoading // 추가: 로딩 상태 받기
}) => {
  const today = new Date();
  const todayDate = today.getDate();

  const dayNamesKorean = ['일', '월', '화', '수', '목', '금', '토'];
  const firstDayOfMonth = new Date(displayYear, displayMonth - 1, 1);
  const startDay = firstDayOfMonth.getDay();
  const daysInMonth = new Date(displayYear, displayMonth, 0).getDate();

  const allHours = Array.from({ length: 17 }, (_, i) => (i + 8) % 24);
  const hoursLine1 = allHours.slice(0, 9);
  const slotsLine1Count = 8 * 2;
  const hoursLine2 = allHours.slice(8);
  const slotsLine2Count = 8 * 2;

  const getSlotTime = (index: number) => {
    const totalMinutes = 8 * 60 + index * 30;
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}`;
  };

  // Helper function to get the date of the Nth occurrence of a weekday in a month
  // month is 0-indexed (e.g., 4 for May, 5 for June, 6 for July)
  // dayOfWeek is 0 (Sunday) - 6 (Saturday)
  // occurrenceN is 1 (first), 2 (second), ..., 5 (last)
  const getNthOccurrenceDate = (year: number, month: number, dayOfWeek: number, occurrenceN: number): Date | null => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    if (occurrenceN === 5) { // "마지막 주" (Last occurrence)
      for (let day = daysInMonth; day >= 1; day--) {
        const currentDate = new Date(year, month, day);
        if (currentDate.getDay() === dayOfWeek) {
          return currentDate;
        }
      }
      return null; // Should not happen for valid dayOfWeek
    }

    // For 1st, 2nd, 3rd, 4th occurrence
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      if (currentDate.getDay() === dayOfWeek) {
        count++;
        if (count === occurrenceN) {
          return currentDate;
        }
      }
    }
    return null; // Nth occurrence not found (e.g., 5th Monday in a month with only 4)
  };


  // 모든 예약 슬롯의 상태를 결정하는 로직 업데이트
  const reservationSlots = Array.from({ length: 32 }, (_, index) => {
    const slotStartTime = getSlotTime(index);
    const slotEndTime = getSlotTime(index + 1);

    const slotStartMinutes = parseInt(slotStartTime.split(':')[0]) * 60 + parseInt(slotStartTime.split(':')[1]);
    const slotEndMinutes = parseInt(slotEndTime.split(':')[0]) * 60 + parseInt(slotEndTime.split(':')[1]);

    let slotStatus: 'available' | 'pending' | 'in-progress' | 'unavailable' = 'available';
    let hasApproved = false;
    let hasPending = false;
    let hasUnavailable = false; // 추가: 예약 불가 상태 플래그

    // selectedDate를 YYYY-MM-DD 형식으로 포매팅하여 사용
    const year = selectedDate.getFullYear();
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const day = selectedDate.getDate().toString().padStart(2, '0');
    const formattedSelectedDate = `${year}-${month}-${day}`;

    const selectedDayOfWeek = selectedDate.getDay(); // 0 (일) - 6 (토)

    // 1. 예약 불가 일정 확인
    for (const schedule of unavailableSchedules) {
      // 캠퍼스 일치 확인
      if (schedule.campus !== selectedCampus) continue;

      const scheduleStartDate = schedule.startDate;
      const scheduleEndDate = schedule.endDate;

      // 기간 내에 있는지 확인
      if (formattedSelectedDate < scheduleStartDate || formattedSelectedDate > scheduleEndDate) continue;

      const scheduleStartMinutes = parseInt(schedule.startTime.split(':')[0]) * 60 + parseInt(schedule.startTime.split(':')[1]);
      const scheduleEndMinutes = parseInt(schedule.endTime.split(':')[0]) * 60 + parseInt(schedule.endTime.split(':')[1]);

      // 시간 범위 겹치는지 확인
      if (scheduleStartMinutes < slotEndMinutes && scheduleEndMinutes > slotStartMinutes) {
        if (schedule.frequencyType === 'once') {
          hasUnavailable = true;
          break;
        } else if (schedule.frequencyType === 'weekly' && schedule.dayOfWeek === selectedDayOfWeek) {
          hasUnavailable = true;
          break;
        } else if (schedule.frequencyType === 'monthly_by_week_day') {
          const currentYear = selectedDate.getFullYear();
          const currentMonth = selectedDate.getMonth(); // 0-indexed month
          const currentDayOfMonth = selectedDate.getDate(); // 현재 날짜의 일

          const firstDayOfCurrentMonth = new Date(currentYear, currentMonth, 1);
          const firstDayWeekday = firstDayOfCurrentMonth.getDay(); // 해당 월 1일의 요일 (0:일, 6:토)

          const firstSunday = firstDayWeekday === 0
            ? 1
            : 1 + (7 - firstDayWeekday);

          const targetOccurrenceN = Math.floor((currentDayOfMonth - firstSunday) / 7) + 1;

          if (schedule.weekOfMonth === targetOccurrenceN && schedule.dayOfWeek === selectedDayOfWeek) {
            hasUnavailable = true;
            break;
          }
        }
      }
    }

    // 2. 일반 예약 확인 (예약 불가 일정보다 우선순위가 낮음)
    for (const res of currentDayReservations) {
      const resStartMinutes = parseInt(res.startTime.split(':')[0]) * 60 + parseInt(res.startTime.split(':')[1]);
      const resEndMinutes = parseInt(res.endTime.split(':')[0]) * 60 + parseInt(res.endTime.split(':')[1]);

      // 두 시간 범위가 겹치는지 확인: (예약 시작 < 슬롯 종료) AND (예약 종료 > 슬롯 시작)
      if (resStartMinutes < slotEndMinutes && resEndMinutes > slotStartMinutes) {
        if (res.status === 'approved') {
          hasApproved = true;
          break; // 승인된 예약이 최우선 순위이므로 더 이상 확인할 필요 없음
        } else if (res.status === 'pending') {
          hasPending = true;
        }
        // rejected, cancelled는 여기에 직접 영향을 주지 않음 (available 상태 유지)
      }
    }

    // 최종 슬롯 상태 결정 (우선순위: approved > unavailable > pending > available)
    if (hasApproved) {
      slotStatus = 'in-progress';
    } else if (hasUnavailable) { // 예약 불가 일정이 있으면
      slotStatus = 'unavailable';
    }
    else if (hasPending) {
      slotStatus = 'pending';
    }
    return slotStatus;
  });


  const reservationSlotsLine1 = reservationSlots.slice(0, slotsLine1Count);
  const reservationSlotsLine2 = reservationSlots.slice(slotsLine1Count, slotsLine1Count + slotsLine2Count);

  // 시간 슬롯 클릭 시 예약 정보를 찾는 헬퍼 함수
  const findOverlappingReservation = (slotIndex: number) => {
    const clickedSlotStartTime = getSlotTime(slotIndex);
    const clickedSlotEndTime = getSlotTime(slotIndex + 1); // 클릭된 슬롯의 종료 시간

    const clickedSlotStartMinutes = parseInt(clickedSlotStartTime.split(':')[0]) * 60 + parseInt(clickedSlotStartTime.split(':')[1]);
    const clickedSlotEndMinutes = parseInt(clickedSlotEndTime.split(':')[0]) * 60 + parseInt(clickedSlotEndTime.split(':')[1]);

    let bestMatch: ReservationData | null = null;
    let currentBestStatusPriority: number = 0; // 0: available, 1: unavailable, 2: pending, 3: in-progress (approved)

    const getStatusPriority = (status: 'pending' | 'approved' | 'rejected' | 'cancelled') => {
      if (status === 'approved') return 3;
      if (status === 'pending') return 2;
      if (status === 'rejected' || status === 'cancelled') return 1; // rejected/cancelled는 낮은 우선순위
      return 0;
    };

    for (const res of currentDayReservations) {
      const resStartMinutes = parseInt(res.startTime.split(':')[0]) * 60 + parseInt(res.startTime.split(':')[1]);
      const resEndMinutes = parseInt(res.endTime.split(':')[0]) * 60 + parseInt(res.endTime.split(':')[1]);

      if (resStartMinutes < clickedSlotEndMinutes && resEndMinutes > clickedSlotStartMinutes) {
        const resPriority = getStatusPriority(res.status);

        if (resPriority > currentBestStatusPriority) {
          bestMatch = res;
          currentBestStatusPriority = resPriority;
          if (currentBestStatusPriority === 3) { // Found 'approved', highest priority
            break;
          }
        }
      }
    }
    return bestMatch;
  };

  // 시간 슬롯 클릭 시 겹치는 예약 불가 일정을 찾는 헬퍼 함수
  const findOverlappingUnavailableSchedule = (slotIndex: number): UnavailableScheduleData | null => {
    const clickedSlotStartTime = getSlotTime(slotIndex);
    const clickedSlotEndTime = getSlotTime(slotIndex + 1);

    const clickedSlotStartMinutes = parseInt(clickedSlotStartTime.split(':')[0]) * 60 + parseInt(clickedSlotStartTime.split(':')[1]);
    const clickedSlotEndMinutes = parseInt(clickedSlotEndTime.split(':')[0]) * 60 + parseInt(clickedSlotEndTime.split(':')[1]);

    // selectedDate를 YYYY-MM-DD 형식으로 포매팅하여 사용
    const year = selectedDate.getFullYear();
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const day = selectedDate.getDate().toString().padStart(2, '0');
    const formattedSelectedDate = `${year}-${month}-${day}`;

    const selectedDayOfWeek = selectedDate.getDay();

    for (const schedule of unavailableSchedules) {
      if (schedule.campus !== selectedCampus) continue;
      if (formattedSelectedDate < schedule.startDate || formattedSelectedDate > schedule.endDate) continue;

      const scheduleStartMinutes = parseInt(schedule.startTime.split(':')[0]) * 60 + parseInt(schedule.startTime.split(':')[1]);
      const scheduleEndMinutes = parseInt(schedule.endTime.split(':')[0]) * 60 + parseInt(schedule.endTime.split(':')[1]);

      if (scheduleStartMinutes < clickedSlotEndMinutes && scheduleEndMinutes > clickedSlotStartMinutes) {
        if (schedule.frequencyType === 'once') {
          return schedule;
        } else if (schedule.frequencyType === 'weekly' && schedule.dayOfWeek === selectedDayOfWeek) {
          return schedule;
        } else if (schedule.frequencyType === 'monthly_by_week_day') {
          const currentYear = selectedDate.getFullYear();
          const currentMonth = selectedDate.getMonth();
          const currentDayOfMonth = selectedDate.getDate();

          const firstDayOfCurrentMonth = new Date(currentYear, currentMonth, 1);
          const firstDayWeekday = firstDayOfCurrentMonth.getDay();

          const firstSunday = firstDayWeekday === 0
            ? 1
            : 1 + (7 - firstDayWeekday);

          const targetOccurrenceN = Math.floor((currentDayOfMonth - firstSunday) / 7) + 1;

          if (schedule.weekOfMonth === targetOccurrenceN && schedule.dayOfWeek === selectedDayOfWeek) {
            return schedule;
          }
        }
      }
    }
    return null;
  };


  return (
    <>
      <header className="app-header">
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
        <button className="login-btn" onClick={handleLoginButtonClick} ref={loginButtonRef}>
          {isLoggedIn
            ? (isLogoutConfirmMode
                ? '로그아웃'
                : (loggedInUserInfo ? loggedInUserInfo.studentInfo : '로그인'))
            : '로그인'}
        </button>
      </header>

      <h1>동아리방 예약</h1>
      {/* 추가된 문구 */}
      <p style={{ fontSize: '0.9em', color: '#dc3545', margin: '0 0 15px 0', fontWeight: 'bold' }}>
        테스트용 웹사이트이니 개인정보 입력은 지양해 주세요.
      </p>

      <div className="calendar-container">
        <div className="calendar-nav">
          <span className="current-month-year">{displayYear}년 {displayMonth}월</span>
          <div className="calendar-nav-buttons">
            <button className="nav-today-btn" onClick={handleTodayClick}>오늘</button>
            <button className="nav-prev-month-btn" onClick={handlePrevMonthClick}>&lt;</button>
            <button className="nav-next-month-btn" onClick={handleNextMonthClick}>&gt;</button>
          </div>
        </div>
        <div className="calendar-grid">
          {dayNamesKorean.map((day, index) => (
            <span key={day} className="day-name">{day}</span>
          ))}
          {Array.from({ length: startDay }).map((_, i) => (
            <span key={`empty-${i}`} className="date-cell empty"></span>
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const date = i + 1;
            const isToday = date === todayDate && displayMonth === today.getMonth() + 1 && displayYear === today.getFullYear();
            const isSelected = date === selectedDate.getDate() && displayMonth === selectedDate.getMonth() + 1 && selectedDate.getFullYear() === displayYear;

            let cellClassName = 'date-cell';
            if (isSelected) {
              cellClassName += ' selected-date';
            } else if (isToday) {
              cellClassName += ' today-date';
            }

            return (
              <span
                key={date}
                className={cellClassName}
                onClick={() => handleDateClick(date)}
              >
                {date}
              </span>
            );
          })}
        </div>
      </div>

      <div className="action-buttons">
        <button
          className="my-reservation-btn"
          onClick={isLoggedIn ? () => navigate('/my-reservations') : requireLogin}
        >
          내 예약
        </button>
        <button
          className="make-reservation-btn"
          onClick={() => handleOpenReservationPage()}
        >
          예약하기
        </button>
      </div>

      <div className="time-display-container">
        {isLoading ? (
          // 로딩 메시지에 인라인 스타일 추가
          <div className="loading-message" style={{ textAlign: 'center', padding: '20px', fontSize: '1.2em', color: '#555', display: 'block' }}>예약 현황을 불러오는 중입니다...</div>
        ) : (
          <>
            <div className="time-line">
              <div className="time-labels">
                {hoursLine1.map((hour) => (
                  <div key={`line1-hour-${hour}`} className="time-label">
                    {hour < 10 ? `0${hour}` : hour}
                  </div>
                ))}
              </div>
              <div className="reservation-slots">
                {reservationSlotsLine1.map((status, index) => (
                  <div
                    key={`line1-slot-${index}`}
                    className={`status-bar ${status}`}
                    onClick={() => {
                      // 로그인 상태가 아니면 무조건 로그인 요청 메시지 표시
                      if (!isLoggedIn) {
                        requireLogin();
                        return;
                      }
                      // 로그인 상태일 경우 기존 로직 수행
                      if (status === 'available') {
                        const startTime = getSlotTime(index);
                        const endTimeIndex = index + 1;
                        const endTime = getSlotTime(endTimeIndex);
                        handleOpenReservationPage(startTime, endTime);
                      } else if (status === 'unavailable') {
                        const overlappingUnavailable = findOverlappingUnavailableSchedule(index);
                        if (overlappingUnavailable) {
                          handleOpenDetailsModal(overlappingUnavailable, 'unavailable');
                        }
                      } else { // in-progress or pending
                        const overlappingRes = findOverlappingReservation(index);
                        if (overlappingRes) {
                          handleOpenDetailsModal(overlappingRes, 'reservation');
                        }
                      }
                    }}
                  ></div>
                ))}
              </div>
            </div>

            <div className="time-line">
              <div className="time-labels">
                {hoursLine2.map((hour) => (
                  <div key={`line2-hour-${hour}`} className="time-label">
                    {hour < 10 ? `0${hour}` : hour}
                  </div>
                ))}
              </div>
              <div className="reservation-slots">
                {reservationSlotsLine2.map((status, index) => (
                  <div
                    key={`line2-slot-${index + slotsLine1Count}`}
                    className={`status-bar ${status}`}
                    onClick={() => {
                      // 로그인 상태가 아니면 무조건 로그인 요청 메시지 표시
                      if (!isLoggedIn) {
                        requireLogin();
                        return;
                      }
                      // 로그인 상태일 경우 기존 로직 수행
                      const absoluteIndex = index + slotsLine1Count;
                      if (status === 'available') {
                        const startTime = getSlotTime(absoluteIndex);
                        const endTimeIndex = absoluteIndex + 1;
                        const endTime = getSlotTime(endTimeIndex);
                        handleOpenReservationPage(startTime, endTime);
                      } else if (status === 'unavailable') {
                        const overlappingUnavailable = findOverlappingUnavailableSchedule(absoluteIndex);
                        if (overlappingUnavailable) {
                          handleOpenDetailsModal(overlappingUnavailable, 'unavailable');
                        }
                      } else { // in-progress or pending
                        const overlappingRes = findOverlappingReservation(absoluteIndex);
                        if (overlappingRes) {
                          handleOpenDetailsModal(overlappingRes, 'reservation');
                        }
                      }
                    }}
                  ></div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="legend">
        <div className="legend-item"><span className="color-box available"></span> 이용 가능</div>
        <div className="legend-item"><span className="color-box in-progress"></span> 예약 중</div>
        <div className="legend-item"><span className="color-box unavailable"></span> 이용 불가</div>
        <div className="legend-item"><span className="color-box pending"></span> 승인 대기</div>
      </div>
    </>
  );
};

function App() {
  const navigate = useNavigate();

  const today = new Date();
  const [displayYear, setDisplayYear] = useState(today.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(today.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));

  const [selectedCampus, setSelectedCampus] = useState<'인캠' | '경캠'>('인캠');

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggedInUserInfo, setLoggedInUserInfo] = useState<UserInfo | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [isLogoutConfirmMode, setIsLogoutConfirmMode] = useState(false);

  const [initialReservationTime, setInitialReservationTime] = useState<{ start: string; end: string } | null>(null);

  const loginButtonRef = useRef<HTMLButtonElement>(null);
  const [allReservations, setAllReservations] = useState<ReservationData[]>([]);
  const [unavailableSchedules, setUnavailableSchedules] = useState<UnavailableScheduleData[]>([]); // 추가: 예약 불가 일정 상태

  // 추가: 데이터 로딩 상태
  const [isLoading, setIsLoading] = useState(true);
  const [reservationsLoaded, setReservationsLoaded] = useState(false);
  const [unavailableSchedulesLoaded, setUnavailableSchedulesLoaded] = useState(false);


  // 예약 상세 정보 모달 관련 상태
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<ReservationData | UnavailableScheduleData | null>(null); // 변경: ReservationData | UnavailableScheduleData
  const [detailsModalType, setDetailsModalType] = useState<'reservation' | 'unavailable' | null>(null); // 추가: 모달에 표시할 데이터 타입

  useEffect(() => {
    // 모든 데이터 로딩이 완료되었는지 확인
    if (reservationsLoaded && unavailableSchedulesLoaded) {
      setIsLoading(false);
    }
  }, [reservationsLoaded, unavailableSchedulesLoaded]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setIsLoggedIn(true);
            setLoggedInUserInfo({
              studentInfo: userData?.studentInfo || user.email || '',
              email: user.email || '',
              role: userData?.role || 'user'
            });
          } else {
            console.warn("Firestore에 사용자 정보(학번+이름)가 없습니다. UID:", user.uid);
            setIsLoggedIn(true);
            setLoggedInUserInfo({ studentInfo: user.email || '', email: user.email || '', role: 'user' });
          }
        } catch (error) {
          console.error("사용자 정보 불러오기 실패:", error);
          setIsLoggedIn(true);
          setLoggedInUserInfo({ studentInfo: user.email || '', email: user.email || '', role: 'user' });
        }
      } else {
        setIsLoggedIn(false);
        setLoggedInUserInfo(null);
      }
      setIsLogoutConfirmMode(false);
    });

    // 예약 데이터 구독
    const reservationsCollectionRef = collection(db, "reservations");
    const qReservations = query(reservationsCollectionRef);

    const unsubscribeReservations = onSnapshot(qReservations, (snapshot) => {
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
      setAllReservations(fetchedReservations);
      setReservationsLoaded(true); // 예약 데이터 로딩 완료
      console.log("Firestore onSnapshot: All reservations updated. Count:", fetchedReservations.length, fetchedReservations);
    }, (error) => {
      console.error("예약 데이터 불러오기 실패:", error);
      setReservationsLoaded(true); // 에러 발생 시에도 로딩 완료 처리 (UI 멈춤 방지)
    });

    // 예약 불가 일정 데이터 구독
    const unavailableSchedulesCollectionRef = collection(db, "unavailableSchedules");
    const qUnavailableSchedules = query(unavailableSchedulesCollectionRef);

    const unsubscribeUnavailableSchedules = onSnapshot(qUnavailableSchedules, (snapshot) => {
      const fetchedUnavailableSchedules: UnavailableScheduleData[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedUnavailableSchedules.push({
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
      setUnavailableSchedules(fetchedUnavailableSchedules);
      setUnavailableSchedulesLoaded(true); // 예약 불가 일정 데이터 로딩 완료
      console.log("Firestore onSnapshot: All unavailable schedules updated. Count:", fetchedUnavailableSchedules.length, fetchedUnavailableSchedules);
    }, (error) => {
      console.error("예약 불가 일정 데이터 불러오기 실패:", error);
      setUnavailableSchedulesLoaded(true); // 에러 발생 시에도 로딩 완료 처리
    });


    return () => {
      unsubscribeAuth();
      unsubscribeReservations();
      unsubscribeUnavailableSchedules(); // 구독 해제
    };
  }, []);

  const currentDayReservations = allReservations.filter(res => {
    // selectedDate를 YYYY-MM-DD 형식으로 직접 포매팅하여 비교
    const year = selectedDate.getFullYear();
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const day = selectedDate.getDate().toString().padStart(2, '0');
    const formattedSelectedDate = `${year}-${month}-${day}`;

    return res.useDate === formattedSelectedDate && res.campus === selectedCampus;
  });

  console.log("App Component Render - selectedDate:", selectedDate.toISOString().split('T')[0], "selectedCampus:", selectedCampus);
  console.log("App Component Render - currentDayReservations count:", currentDayReservations.length, currentDayReservations);

  // 예약 상세 정보 모달을 여는 핸들러 (예약 또는 예약 불가 일정 모두 처리)
  const handleOpenDetailsModal = (item: ReservationData | UnavailableScheduleData, type: 'reservation' | 'unavailable') => {
    setSelectedItemForDetails(item);
    setDetailsModalType(type);
    setShowDetailsModal(true);
  };

  // 예약 상세 정보 모달을 닫는 핸들러
  const handleCloseDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedItemForDetails(null);
    setDetailsModalType(null);
  };

  // 실제 로그아웃을 수행하는 함수
  const performLogout = async () => {
    try {
      await signOut(auth);
      setIsLoggedIn(false);
      setLoggedInUserInfo(null);
      setIsLogoutConfirmMode(false); // 로그아웃 후에는 확인 모드 해제
      alert('로그아웃 되었습니다.');
      navigate('/'); // 메인 페이지로 이동
    } catch (error) {
      console.error("로그아웃 실패:", error);
      alert("로그아웃에 실패했습니다.");
    }
  };


  const handleLoginSubmit = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setShowLoginModal(false);
    } catch (error: any) {
      console.error("로그인 실패:", error.code, error.message);
      let errorMessage = "로그인에 실패했습니다.";
      if (error.code === 'auth/invalid-email') {
        errorMessage = '유효하지 않은 이메일 주소입니다.';
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다.';
      }
      alert(errorMessage);
    }
  };

  const handleSignupSubmit = async (studentInfo: string, email: string, password: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        studentInfo: studentInfo,
        email: email,
        createdAt: new Date(),
        role: 'user'
      });

      console.log("회원가입 완료 및 사용자 정보 Firestore 저장:", user);
      await signOut(auth);
      setShowSignupModal(false);
      setShowLoginModal(true);
      alert('회원가입이 완료되었습니다. 새로 로그인 해주세요.');
    } catch (error: any) {
      console.error("회원가입 실패:", error.code, error.message);
      let errorMessage = "회원가입에 실패했습니다.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = '이미 사용 중인 이메일입니다.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = '비밀번호는 최소 6자 이상이어야 합니다.';
      }
      alert(errorMessage);
    }
  };

  const handleOpenReservationPage = (initialStart?: string, initialEnd?: string) => {
    if (!isLoggedIn) {
      requireLogin();
      return;
    }
    setInitialReservationTime(initialStart && initialEnd ? { start: initialStart, end: initialEnd } : null);
    navigate('/reservation');
  };

  const handleReservationSubmit = async (reservationData: ReservationData) => {
    console.log("예약 신청 데이터:", reservationData);
    try {
      await addDoc(collection(db, "reservations"), {
        ...reservationData,
        userId: auth.currentUser?.uid,
        status: 'pending',
        submittedAt: new Date()
      });
      alert('예약 신청이 완료되었습니다. 관리자 승인을 기다려주세요!');
      navigate('/');
    } catch (error) {
      console.error("예약 신청 실패:", error);
      alert('예약 신청 중 오류가 발생했습니다.');
    }
  };

  const handleLoginButtonClick = async () => {
    if (isLoggedIn) {
      if (isLogoutConfirmMode) {
        // '로그아웃' 버튼을 다시 눌러 로그아웃을 확정하는 경우
        performLogout();
      } else {
        // 로그인 상태이고 로그아웃 확인 모드가 아닐 때 (즉, '학번+이름' 버튼 클릭 시)
        // 관리자 역할인지 확인하여 관리자 페이지 또는 로그아웃 확인 모드로 전환
        if (loggedInUserInfo?.role === 'admin') {
          navigate('/admin'); // 관리자 페이지로 이동
        } else {
          setIsLogoutConfirmMode(true); // 일반 사용자는 로그아웃 확인 모드
        }
      }
    } else {
      setShowLoginModal(true);
    }
  };

  const requireLogin = () => {
    alert('로그인이 필요합니다. 로그인해주세요.');
    setShowLoginModal(true);
  };

  const handleShowSignupModal = () => {
    setShowLoginModal(false);
    setShowSignupModal(true);
  };

  const handleShowLoginModal = () => {
    setShowSignupModal(false);
    setShowLoginModal(true);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isLogoutConfirmMode && loginButtonRef.current && !loginButtonRef.current.contains(event.target as Node)) {
        setIsLogoutConfirmMode(false);
      }
    };
    if (isLogoutConfirmMode) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLogoutConfirmMode]);

  return (
    <div className="App">
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onLoginSubmit={handleLoginSubmit}
          onShowSignup={handleShowSignupModal}
        />
      )}
      {showSignupModal && (
        <SignupModal
          onClose={() => setShowSignupModal(false)}
          onSignupSubmit={handleSignupSubmit}
          onShowLogin={handleShowLoginModal}
        />
      )}

      {/* 예약 상세 정보 모달 렌더링 */}
      {showDetailsModal && (
        <ReservationDetailsModal
          data={selectedItemForDetails} // prop 이름 변경
          dataType={detailsModalType} // 새로운 prop 추가
          onClose={handleCloseDetailsModal}
        />
      )}

      <Routes>
        <Route path="/" element={
          <MainContent
            selectedCampus={selectedCampus}
            handleCampusClick={() => setSelectedCampus(prevCampus => (prevCampus === '인캠' ? '경캠' : '인캠'))}
            isLoggedIn={isLoggedIn}
            loggedInUserInfo={loggedInUserInfo}
            isLogoutConfirmMode={isLogoutConfirmMode}
            handleLoginButtonClick={handleLoginButtonClick}
            loginButtonRef={loginButtonRef}
            displayYear={displayYear}
            displayMonth={displayMonth}
            selectedDate={selectedDate}
            handleTodayClick={() => {
              const currentYear = new Date().getFullYear();
              const currentMonth = new Date().getMonth() + 1;
              const currentDate = new Date().getDate();
              setDisplayYear(currentYear);
              setDisplayMonth(currentMonth);
              setSelectedDate(new Date(currentYear, currentMonth - 1, currentDate));
            }}
            handlePrevMonthClick={() => {
              let newMonth = displayMonth - 1;
              let newYear = displayYear;
              if (newMonth < 1) { newMonth = 12; newYear -= 1; }
              const lastDayOfPrevMonth = new Date(newYear, newMonth, 0).getDate();
              setDisplayMonth(newMonth);
              setDisplayYear(newYear);
              setSelectedDate(new Date(newYear, newMonth - 1, 1));
            }}
            handleNextMonthClick={() => {
              let newMonth = displayMonth + 1;
              let newYear = displayYear;
              if (newMonth > 12) { newMonth = 1; newYear += 1; }
              setDisplayMonth(newMonth);
              setDisplayYear(newYear);
              setSelectedDate(new Date(newYear, newMonth - 1, 1));
            }}
            handleDateClick={(date: number) => setSelectedDate(new Date(displayYear, displayMonth - 1, date))}
            handleSlotClick={(status, index) => { /* MainContent 내부로 로직 이동 */ }}
            handleOpenReservationPage={handleOpenReservationPage}
            requireLogin={requireLogin}
            currentDayReservations={currentDayReservations}
            unavailableSchedules={unavailableSchedules} // 추가: 예약 불가 일정 전달
            navigate={navigate}
            handleOpenDetailsModal={handleOpenDetailsModal}
            isLoading={isLoading} // 추가: 로딩 상태 전달
          />
        } />
        <Route
          path="/reservation"
          element={
            <ReservationPage
              onClose={() => navigate('/')}
              selectedDate={selectedDate}
              initialStartTime={initialReservationTime?.start}
              initialEndTime={initialReservationTime?.end}
              loggedInUserInfo={loggedInUserInfo}
              selectedCampus={selectedCampus}
              onSubmitReservation={handleReservationSubmit}
              currentDayReservations={currentDayReservations} // 추가: 현재 예약 정보 전달
              handleCampusClick={() => setSelectedCampus(prevCampus => (prevCampus === '인캠' ? '경캠' : '인캠'))}
            />
          }
        />
        <Route
          path="/my-reservations"
          element={
            <MyReservationsPage
              onClose={() => navigate('/')}
              loggedInUserInfo={loggedInUserInfo}
            />
          }
        />
        {/* 관리자 페이지 라우트 추가 */}
        <Route
          path="/admin"
          element={
            <AdminPage
              loggedInUserInfo={loggedInUserInfo}
              onLogout={performLogout} // performLogout 함수를 전달
            />
          }
        />
      </Routes>
    </div>
  );
}

const AppWrapper: React.FC = () => (
  <Router>
    <App />
  </Router>
);

export default AppWrapper;
