// fnIngest — IoT Rule(evt JSON) 또는 생명주기(disconnected) 처리
// 내부 로직은 다음 spec에서 구현
export const handler = async (event) => {
  console.log('fnIngest invoked', JSON.stringify(event));
  return { statusCode: 200, body: 'OK' };
};
