import React from 'react'
const Avatar = ({username, userId, online}) => {

    const colors = ['bg-red-200', 'bg-green-200',
                    'bg-yellow-200', 'bg-blue-200',
                    'bg-purple-200', 'bg-gray-200'];

    const userIdBase10 = parseInt(userId, 16);
    const colorIndex = userIdBase10 % colors.length;
    const color = colors[colorIndex];
    return (
        <div className = {"w-8 h-8 relative rounded-full flex items-center " + color}>
            <div className = "text-center w-full font-bold text-purple-800">
                {username[0]}
            </div>
            {online && (
                <div className = "absolute w-3 h-3 bg-green-500 bottom-0 right-0 rounded-full border border-white"></div>
            )}
            {!online && (
                <div className = "absolute w-3 h-3 bg-gray-300 bottom-0 right-0 rounded-full border border-white"></div>
            )}
        </div>
  );
};

export default Avatar;