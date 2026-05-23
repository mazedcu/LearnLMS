import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/token/refresh/`,
          { refresh }
        );
        localStorage.setItem('access_token', data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export const authAPI = {
  register: (data) => api.post('/auth/register/', data),
  login: (data) => api.post('/auth/login/', data),
  me: () => api.get('/auth/me/'),
  updateMe: (data) => api.patch('/auth/me/', data),
  users: () => api.get('/auth/users/'),
  updateUser: (id, data) => api.patch(`/auth/users/${id}/`, data),
  deleteUser: (id) => api.delete(`/auth/users/${id}/delete/`),
  platformStats: () => api.get('/auth/stats/'),
};

export const adminAPI = {
  // Courses
  deleteCourse: (slug) => api.delete(`/courses/${slug}/`),
  // Modules
  createModule: (courseSlug, data) => api.post(`/courses/${courseSlug}/modules/`, data),
  updateModule: (id, data) => api.patch(`/courses/modules/${id}/`, data),
  deleteModule: (id) => api.delete(`/courses/modules/${id}/`),
  // Lessons
  createLesson: (moduleId, data) => api.post(`/courses/modules/${moduleId}/lessons/`, data),
  updateLesson: (id, data) => api.patch(`/courses/lessons/${id}/`, data),
  deleteLesson: (id) => api.delete(`/courses/lessons/${id}/`),
  // Content blocks
  createBlock: (lessonId, data) => api.post(`/content/lessons/${lessonId}/blocks/`, data),
  updateBlock: (id, data) => api.patch(`/content/blocks/${id}/`, data),
  deleteBlock: (id) => api.delete(`/content/blocks/${id}/`),
  // Drip rules
  setDripRule: (data) => api.post('/drip/rules/', data),
  updateDripRule: (lessonId, data) => api.patch(`/drip/rules/${lessonId}/`, data),
  manualUnlock: (lessonId, data) => api.post(`/drip/unlock/${lessonId}/`, data),
  // Quiz/Question Management (admin)
  getQuizzes: (lessonId) => api.get(`/assessments/lessons/${lessonId}/quizzes/`),
  createQuiz: (lessonId, data) => api.post(`/assessments/lessons/${lessonId}/quizzes/`, data),
  updateQuiz: (id, data) => api.patch(`/assessments/quizzes/${id}/`, data),
  deleteQuiz: (id) => api.delete(`/assessments/quizzes/${id}/`),
  
  getQuestions: (quizId) => api.get(`/assessments/quizzes/${quizId}/questions/`),
  createQuestion: (quizId, data) => api.post(`/assessments/quizzes/${quizId}/questions/`, data),
  updateQuestion: (id, data) => api.patch(`/assessments/questions/${id}/`, data),
  deleteQuestion: (id) => api.delete(`/assessments/questions/${id}/`),
};

export const coursesAPI = {
  list: (params) => api.get('/courses/', { params }),
  detail: (slug) => api.get(`/courses/${slug}/`),
  create: (data) => api.post('/courses/', data),
  update: (slug, data) => api.patch(`/courses/${slug}/`, data),
  modules: (slug) => api.get(`/courses/${slug}/modules/`),
  enroll: (slug) => api.post(`/courses/${slug}/enroll/`),
  myEnrollments: () => api.get('/courses/my-enrollments/'),
};

export const lessonsAPI = {
  detail: (id) => api.get(`/content/lessons/${id}/`),
  blocks: (id) => api.get(`/content/lessons/${id}/blocks/`),
  complete: (id) => api.post(`/content/lessons/${id}/complete/`),
  dripStatus: (id) => api.get(`/content/lessons/${id}/drip-status/`),
};

export const assessmentsAPI = {
  // Quizzes for a lesson
  listQuizzes: (lessonId) => api.get(`/assessments/lessons/${lessonId}/quizzes/`),
  
  // Quiz interaction
  startQuiz: (quizId) => api.post(`/assessments/quizzes/${quizId}/start/`),
  getRenderedQuestions: (submissionId) =>
    api.get(`/assessments/submissions/${submissionId}/questions/`),
  submitAnswer: (submissionId, questionId, data) =>
    api.post(`/assessments/submissions/${submissionId}/submit/${questionId}/`, data),
  finishQuiz: (submissionId) => api.post(`/assessments/submissions/${submissionId}/finish/`),

  // Results
  getSubmission: (id) => api.get(`/assessments/submissions/${id}/`),
};

export const paymentsAPI = {
  createOrder: (data) => api.post('/payments/orders/', data),
  submitReference: (id, data) => api.post(`/payments/orders/${id}/reference/`, data),
  getOrder: (id) => api.get(`/payments/orders/${id}/`),
  pendingOrders: () => api.get('/payments/orders/pending/'),
  myOrders: () => api.get('/payments/orders/my/'),
  verifyOrder: (id, data) => api.patch(`/payments/orders/${id}/verify/`, data),
};

export const progressAPI = {
  courseProgress: (enrollmentId) => api.get(`/progress/enrollment/${enrollmentId}/`),
  studentAnalytics: (userId) => api.get(`/progress/student/${userId}/`),
  courseAnalytics: (slug) => api.get(`/progress/course/${slug}/`),
};

export const reportsAPI = {
  userActivity: () => api.get('/progress/admin/reports/users/'),
  quizResults: () => api.get('/progress/admin/reports/quizzes/'),
  recentActivity: () => api.get('/progress/admin/reports/recent/'),
};

export const certificatesAPI = {
  list: () => api.get('/certificates/'),
  download: (id) => api.get(`/certificates/${id}/download/`, { responseType: 'blob' }),
  verify: (uuid) => api.get(`/certificates/verify/${uuid}/`),
};
