import { useMemo, useState } from "react";
import { organizations } from "../data/organizations.js";
import BrandLogo from "../components/BrandLogo.jsx";
import { Button, SelectInput, TextArea, TextInput } from "../components/UI.jsx";
import { authenticateUser, readAllUsers } from "../services/authService.js";
import { appendSignupRequest, readSignupRequests } from "../services/signupRequestService.js";

function formatPhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export default function LoginPage({ onLogin, navigate }) {
  const [loginId, setLoginId] = useState("checker");
  const [password, setPassword] = useState("1234");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const matchedUser = authenticateUser(loginId.trim(), password);

    if (!matchedUser) {
      setError("아이디 또는 비밀번호를 확인해주세요.");
      return;
    }

    setError("");
    onLogin(matchedUser);
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <BrandLogo />
        </div>
        <p className="eyebrow">지역 돌봄 운영 시스템</p>
        <p className="muted">
          지역 어르신의 생활 확인 기록과 이상징후 전달을 기관 운영 흐름에 맞게 관리합니다.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <TextInput
            id="login-id"
            label="아이디"
            autoComplete="username"
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
          />
          <TextInput
            id="login-password"
            label="비밀번호"
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <p className="form-error">{error}</p> : null}
          <Button className="full-width" type="submit">
            로그인
          </Button>
        </form>

        <div className="login-sub-actions">
          <Button className="full-width" variant="ghost" onClick={() => navigate("/signup")}>
            회원가입 신청
          </Button>
        </div>

        <div className="test-accounts">
          <strong>테스트 계정</strong>
          <p>체커: checker / 1234</p>
          <p>관리자: admin / 1234</p>
        </div>
      </section>
    </main>
  );
}

export function SignupRequestPage({ navigate }) {
  const [form, setForm] = useState({
    loginId: "",
    password: "",
    passwordConfirm: "",
    name: "",
    phone: "",
    role: "checker",
    organizationId: "",
    memo: "",
  });
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const passwordMismatch = useMemo(() => {
    if (!form.passwordConfirm) {
      return false;
    }

    return form.password !== form.passwordConfirm;
  }, [form.password, form.passwordConfirm]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function handlePhoneChange(value) {
    updateField("phone", formatPhoneNumber(value));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (
      !form.loginId.trim() ||
      !form.password ||
      !form.passwordConfirm ||
      !form.name.trim() ||
      !form.phone.trim() ||
      !form.role.trim() ||
      !form.organizationId
    ) {
      setError("아이디, 비밀번호, 이름, 연락처, 역할, 소속 기관은 필수 입력입니다.");
      return;
    }

    if (form.password.length < 6) {
      setError("비밀번호는 6자 이상 입력해주세요.");
      return;
    }

    if (form.password !== form.passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    const requestList = readSignupRequests();
    const normalizedLoginId = form.loginId.trim().toLowerCase();
    const existingUsers = readAllUsers();
    const selectedOrganization = organizations.find((organization) => organization.id === form.organizationId);

    const existsInRequests = requestList.some(
      (request) => String(request.loginId || "").trim().toLowerCase() === normalizedLoginId
    );
    const existsInUsers = existingUsers.some(
      (user) => String(user.username || user.loginId || user.id || "").trim().toLowerCase() === normalizedLoginId
    );

    if (existsInRequests || existsInUsers) {
      setError("이미 사용 중이거나 신청된 아이디입니다.");
      return;
    }

    const nextRequest = {
      id: `signup-${Date.now()}`,
      loginId: form.loginId.trim(),
      // MVP localStorage 저장용입니다. 실서비스에서는 비밀번호 해시 저장이 필요합니다.
      password: form.password,
      name: form.name.trim(),
      phone: form.phone.trim(),
      role: form.role,
      organizationId: form.organizationId,
      organizationName: selectedOrganization?.name || "",
      region: selectedOrganization?.region || "",
      memo: form.memo.trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    appendSignupRequest(nextRequest);
    setSubmitted(true);
    setError("");
    setForm({
      loginId: "",
      password: "",
      passwordConfirm: "",
      name: "",
      phone: "",
      role: "checker",
      organizationId: "",
      memo: "",
    });
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <BrandLogo />
        </div>
        <p className="eyebrow">서비스 이용 신청</p>
        <h1>서비스 이용 신청</h1>
        <p className="muted">해피통서비스는 담당 기관의 승인 후 이용할 수 있습니다. 신청 내용을 확인한 뒤 관리자 승인 절차가 진행됩니다.</p>

        {submitted ? (
          <p className="notice signup-notice">이용 신청이 접수되었습니다. 담당자 승인 후 서비스 이용이 가능합니다.</p>
        ) : null}

        <form className="login-form" onSubmit={handleSubmit}>
          <TextInput
            id="signup-login-id"
            label="아이디"
            autoComplete="username"
            placeholder="예: checker01"
            value={form.loginId}
            onChange={(event) => updateField("loginId", event.target.value)}
          />
          <TextInput
            id="signup-password"
            label="비밀번호"
            type="password"
            autoComplete="new-password"
            placeholder="6자 이상 입력"
            value={form.password}
            onChange={(event) => updateField("password", event.target.value)}
          />
          <TextInput
            id="signup-password-confirm"
            label="비밀번호 확인"
            type="password"
            autoComplete="new-password"
            placeholder="비밀번호를 다시 입력해주세요"
            value={form.passwordConfirm}
            onChange={(event) => updateField("passwordConfirm", event.target.value)}
          />
          {passwordMismatch ? <p className="form-error inline-form-error">비밀번호가 일치하지 않습니다.</p> : null}
          <TextInput
            id="signup-name"
            label="이름"
            autoComplete="name"
            placeholder="예: 김하나"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
          />
          <TextInput
            id="signup-phone"
            label="연락처"
            autoComplete="tel"
            placeholder="예: 010-1234-5678"
            value={form.phone}
            onChange={(event) => handlePhoneChange(event.target.value)}
          />
          <p className="field-helper">입력한 연락처는 승인 과정에서 본인 확인 및 연락 목적으로 사용됩니다.</p>
          <SelectInput
            id="signup-role"
            label="역할 선택"
            value={form.role}
            onChange={(event) => updateField("role", event.target.value)}
          >
            <option value="admin">관리자</option>
            <option value="checker">체커</option>
          </SelectInput>
          <SelectInput
            id="signup-organization"
            label="소속 기관 선택"
            value={form.organizationId}
            onChange={(event) => updateField("organizationId", event.target.value)}
          >
            <option value="">소속 기관을 선택해주세요</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name} · {organization.region}
              </option>
            ))}
          </SelectInput>
          <TextArea
            id="signup-memo"
            label="신청 사유 또는 메모"
            rows="4"
            placeholder="예: 은평구 돌봄센터 체커 활동 신청"
            value={form.memo}
            onChange={(event) => updateField("memo", event.target.value)}
          />
          {error ? <p className="form-error">{error}</p> : null}
          <div className="login-form-actions">
            <Button className="full-width" type="submit">
              신청하기
            </Button>
            <Button className="full-width" variant="secondary" onClick={() => navigate("/login")}>
              로그인으로 돌아가기
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
