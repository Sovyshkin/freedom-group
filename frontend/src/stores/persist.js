/* eslint-disable */
import Cookies from 'js-cookie'

export const cookieStorage = {
  getItem: (key) => {
    return Cookies.get(key) || null
  },
  setItem: (key, value, options = {}) => {
    Cookies.set(key, value, { 
      expires: 7,
      path: '/',
      ...options 
    })
  },
  removeItem: (key) => {
    Cookies.remove(key, { path: '/' })
  }
}