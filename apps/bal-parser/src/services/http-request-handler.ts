const HandleHTTPResponse = async (response: Response): Promise<any> => {
  const contentType = response.headers.get('content-type');

  if (!response.ok) {
    let error;
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      error = new Error(data.message || response.statusText);
    } else {
      const text = await response.text();
      error = new Error(text || response.statusText);
    }
    throw error;
  }

  if (contentType && contentType.includes('application/json')) {
    return response.json();
  } else {
    return response.text();
  }
};

export default HandleHTTPResponse;
