import React, { useContext, useState } from "react";
import axios from "axios";
import { UserContext } from './UserContext.jsx';

const RegisterAndLoginForm = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoginOregister, setIsLoginOrRegister] = useState('login');
    const {setUsername : setLoggedInUsername, setId} = useContext(UserContext);
    async function handleSubmit(ev){
      ev.preventDefault(); 
      try{
        const url = isLoginOregister === 'register' ? '/register' : '/login';
        const {data} = await axios.post(url, {username, password});
        setLoggedInUsername(username);
        setId(data.id);
      }
      catch (error) {
        console.error('Registration/Login error:', error);
        alert('Error: ' + error.response?.data || error.message);
      }
    }

  return (
    <div className = 'bg-stone-800 h-screen flex items-center'>
        <form className='w-64 mx-auto mb-12' onSubmit = {handleSubmit}>
            <input type = "text" placeholder = "username" className = 'p-2 mb-2 block w-full rounded-xl' value = {username} onChange = {ev => setUsername(ev.target.value)}/>
            <input type = "password" placeholder = "password" className = 'p-2 my-2 block w-full rounded-xl' value = {password} onChange={ev => setPassword(ev.target.value)}/>
            <button className = "bg-blue-600 p-2 text-white block w-full rounded-xl">
              {isLoginOregister === 'register' ? 'Register' : 'Login'}
            </button>
            <div className = "border-green-400 text-neutral-50 text-center mt-2">
                {isLoginOregister === 'register' && (
                <div>
                Already a member? 
                <button className="ml-1" onClick = {() => {
                  setIsLoginOrRegister('login')
                  }}>Login here
                </button>
                </div>
                )}

              {isLoginOregister === 'login' && (
                <div>
                  Don't have an account? 
                  <button className="ml-1" onClick = {() => {setIsLoginOrRegister('register')}}>
                  Register here
                  </button>
                </div>
              )}
            
            </div>
        </form>
    </div>
  )
}

export default RegisterAndLoginForm;