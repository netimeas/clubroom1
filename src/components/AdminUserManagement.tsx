import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDocs, where } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig'; // auth도 필요하므로 임포트
import { UserInfo } from './AdminPage'; // UserInfo 인터페이스 임포트 (AdminPage.tsx에 정의된 것을 재사용)

// AdminPage.tsx에 이미 AdminPage.css가 임포트되어 있으므로 이 파일에서는 별도 임포트 안 함

interface AdminUserManagementProps {
  loggedInUserInfo: UserInfo | null;
}

const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ loggedInUserInfo }) => {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const usersCollectionRef = collection(db, 'users');
    // 모든 사용자를 가져오지만, 정렬은 클라이언트에서 처리 (Firestore orderBy는 인덱스 필요)
    const q = query(usersCollectionRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers: UserInfo[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedUsers.push({
          uid: doc.id, // 사용자 UID를 id로 저장
          studentInfo: data.studentInfo,
          email: data.email,
          role: data.role || 'user', // role이 없으면 기본값 'user'
        } as UserInfo);
      });

      // 사용자 정렬 로직:
      // 1. 현재 로그인된 관리자를 맨 위로
      // 2. 다른 관리자 (나 자신 제외)
      // 3. 일반 회원 (학번+이름 오름차순)
      let sortedUsers: UserInfo[] = [];
      const currentAdmin = fetchedUsers.find(u => u.uid === auth.currentUser?.uid);
      const otherUsers = fetchedUsers.filter(u => u.uid !== auth.currentUser?.uid);

      if (currentAdmin) {
        sortedUsers.push(currentAdmin);
      }

      const otherAdmins = otherUsers.filter(u => u.role === 'admin').sort((a, b) => a.studentInfo.localeCompare(b.studentInfo));
      const regularUsers = otherUsers.filter(u => u.role !== 'admin').sort((a, b) => a.studentInfo.localeCompare(b.studentInfo));

      sortedUsers = sortedUsers.concat(otherAdmins).concat(regularUsers);

      setUsers(sortedUsers);
      setLoading(false);
    }, (err) => {
      console.error('회원 목록 불러오기 실패:', err);
      setError('회원 목록을 불러오는 데 실패했습니다.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [loggedInUserInfo]); // loggedInUserInfo가 변경될 때마다 다시 실행 (role 변경 등)

  const handleUserClick = (user: UserInfo) => {
    // 나 자신을 클릭하면 아무것도 하지 않음
    if (user.uid === auth.currentUser?.uid) {
      setSelectedUser(null); // 혹시 선택되어 있다면 해제
      return;
    }
    setSelectedUser((prev: UserInfo | null) => (prev?.uid === user.uid ? null : user)); // prev에 타입 명시
  };

  const handleAssignAdmin = async (userUid: string) => {
    if (!window.confirm('이 회원을 관리자로 지정하시겠습니까?')) {
      return;
    }
    try {
      const userRef = doc(db, 'users', userUid);
      await updateDoc(userRef, {
        role: 'admin',
      });
      alert('회원이 관리자로 지정되었습니다.');
      setSelectedUser(null);
    } catch (error) {
      console.error('관리자 지정 실패:', error);
      alert('관리자 지정 중 오류가 발생했습니다.');
    }
  };

  const handleRevokeAdmin = async (userUid: string) => {
    if (!window.confirm('이 관리자의 권한을 해제하시겠습니까? (일반 회원으로 변경됩니다)')) {
      return;
    }
    try {
      const userRef = doc(db, 'users', userUid);
      await updateDoc(userRef, {
        role: 'user',
      });
      alert('관리자 권한이 해제되었습니다.');
      setSelectedUser(null);
    } catch (error) {
      console.error('관리자 권한 해제 실패:', error);
      alert('관리자 권한 해제 중 오류가 발생했습니다.');
    }
  };

  const handleBanUser = async (userUid: string) => {
    if (!window.confirm('이 회원을 추방하시겠습니까? (모든 데이터가 삭제됩니다)')) {
      return;
    }
    try {
      // 1. 해당 사용자의 예약 데이터 삭제
      const reservationsQuery = query(collection(db, 'reservations'), where('userId', '==', userUid));
      const reservationSnapshot = await getDocs(reservationsQuery);
      const deleteReservationPromises = reservationSnapshot.docs.map(d => deleteDoc(doc(db, 'reservations', d.id)));
      await Promise.all(deleteReservationPromises);

      // 2. 사용자 문서 삭제
      await deleteDoc(doc(db, 'users', userUid));

      alert('회원이 성공적으로 추방되었습니다.');
      setSelectedUser(null);
    } catch (error) {
      console.error('회원 추방 실패:', error);
      alert('회원 추방 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return <div className="admin-section-loading">회원 목록을 불러오는 중...</div>;
  }

  if (error) {
    return <div className="admin-section-error">{error}</div>;
  }

  return (
    <div className="admin-user-management">
      <h2 className="admin-section-title">회원 관리</h2>
      <div className="user-list-container">
        {users.length === 0 ? (
          <p className="no-users">등록된 회원이 없습니다.</p>
        ) : (
          <ul className="user-list">
            {users.map((user) => (
              <li
                key={user.uid}
                className={`user-item ${selectedUser?.uid === user.uid ? 'selected' : ''} ${user.uid === auth.currentUser?.uid ? 'current-admin' : ''}`}
                onClick={() => handleUserClick(user)}
              >
                <span className="user-info-display">
                  {user.studentInfo} ({user.email})
                </span>
                {user.role === 'admin' && <span className="admin-indicator">관리자</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedUser && selectedUser.uid !== auth.currentUser?.uid && ( // 나 자신은 선택 시 아무것도 안 함
        <div className="user-detail-card">
          <h3>회원 상세 정보</h3>
          <p><strong>학번+이름:</strong> {selectedUser.studentInfo}</p>
          <p><strong>이메일:</strong> {selectedUser.email}</p>
          <p><strong>역할:</strong> {selectedUser.role === 'admin' ? '관리자' : '일반 회원'}</p>
          <div className="detail-actions">
            {selectedUser.role !== 'admin' && ( // 일반 회원일 때만 '관리자 지정' 버튼
              <button
                className="action-button assign-admin-btn"
                onClick={() => handleAssignAdmin(selectedUser.uid as string)}
              >
                관리자 지정
              </button>
            )}
            {selectedUser.role === 'admin' && ( // 다른 관리자일 때만 '관리자 해제' 버튼
              <button
                className="action-button revoke-admin-btn"
                onClick={() => handleRevokeAdmin(selectedUser.uid as string)}
              >
                관리자 해제
              </button>
            )}
            {selectedUser.role !== 'admin' && ( // 일반 회원일 때만 '추방' 버튼 (관리자는 해제 후 추방)
              <button
                className="action-button ban-user-btn"
                onClick={() => handleBanUser(selectedUser.uid as string)}
              >
                추방
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagement;
