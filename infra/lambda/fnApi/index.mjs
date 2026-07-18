// fnApi — REST 핸들러 (HTTP API → Lambda)
// 내부 로직은 다음 spec에서 구현
export const handler = async (event) => {
  console.log('fnApi invoked', JSON.stringify(event));
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, data: {} }),
  };
};
