export const organizations = [
  {
    id: "org-eunpyeong-care",
    name: "은평구 돌봄센터",
    region: "서울시 은평구",
  },
  {
    id: "org-chungju-pungdong",
    name: "충주시 풍동 행정복지센터",
    region: "충청북도 충주시",
  },
  {
    id: "org-mapo-mangwon",
    name: "마포구 망원동 돌봄센터",
    region: "서울시 마포구",
  },
];

export const defaultUserOrganizations = {
  checker: "org-eunpyeong-care",
  checker2: "org-mapo-mangwon",
  checker3: "org-chungju-pungdong",
  admin: "org-eunpyeong-care",
};

export function getOrganizationById(organizationId) {
  return organizations.find((organization) => organization.id === organizationId) ?? null;
}
