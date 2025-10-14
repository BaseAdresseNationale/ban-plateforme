const fakeApiCall = (fakeData: any, milliseconds: 2000): Promise<any> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(new Response(JSON.stringify(fakeData), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }, milliseconds);
  });
}

// Using async/await to make the fake API call
const fetchFakeData = async (fakeData: any) => {
    try {
        const data = await fakeApiCall(fakeData, 2000);
        console.log(data);
      return { data };
      } catch (error) {
        console.error("Error fetching data:", error);
      }
}
  
export {
    fakeApiCall,
    fetchFakeData,
}