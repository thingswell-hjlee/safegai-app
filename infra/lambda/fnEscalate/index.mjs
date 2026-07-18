// fnEscalate — 1분 주기 에스컬레이션 처리
// 내부 로직은 다음 spec에서 구현
export const handler = async (event) => {
  console.log('fnEscalate invoked', JSON.stringify(event));
  return { statusCode: 200, body: 'OK' };
};
