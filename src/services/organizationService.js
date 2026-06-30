import { organizations as sourceOrganizations } from "../data/organizations.js";

const fallbackOrganizations = [
  {
    id: "org-eunpyeong-care",
    name: "은평구 돌봄센터",
    region: "서울시 은평구",
    adminName: "박서연 관리자",
    status: "active",
    statusLabel: "운영중",
    memo: "독거노인 생활 확인 시범 운영 기관",
  },
  {
    id: "org-chungju-pungdong",
    name: "충주 풍동 행정복지센터",
    region: "충청북도 충주시",
    adminName: "미배정",
    status: "pilot",
    statusLabel: "파일럿",
    memo: "지역 돌봄 운영 검토 기관",
  },
  {
    id: "org-mapo-mangwon",
    name: "마포구 망원 돌봄센터",
    region: "서울시 마포구",
    adminName: "김도연 관리자",
    status: "active",
    statusLabel: "운영중",
    memo: "동네 기반 안부 확인 운영 기관",
  },
];

export function readOrganizations() {
  if (!Array.isArray(sourceOrganizations) || !sourceOrganizations.length) {
    return fallbackOrganizations;
  }

  return fallbackOrganizations.map((fallbackOrganization) => {
    const sourceOrganization = sourceOrganizations.find((item) => item.id === fallbackOrganization.id) || {};
    return {
      ...fallbackOrganization,
      ...sourceOrganization,
      name: fallbackOrganization.name,
      region: fallbackOrganization.region,
    };
  });
}
