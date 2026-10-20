const usuario = 'a054ff39-dbe6-485d-9c6d-0cc60e8f159b'
export const supabase = { auth: {
  getSession: async () => ({ data: { session: { user: { id: usuario } } } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
} }
