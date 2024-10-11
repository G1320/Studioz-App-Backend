type ValidationLabels = {
  [key: string]: string,
};

const validationLabels: ValidationLabels = {
  name: 'Studio name',
  description: 'Studio description',
};

type ErrorType = {
  name: string,
  message: string,
  errors?: {
    [key: string]: {
      path: string,
      message: string,
    },
  },
};
export const handleDbErrorMsg = (error: ErrorType): string => {
  switch (error.name) {
    case 'CastError':
      console.error('Invalid ID format:', error);
      return `Invalid request data: ${error.message}`;

    case 'ValidationError': {
      console.error('Validation Error:', error);

      const errors = error.errors
        ? Object.values(error.errors).map((e) => {
            const label = validationLabels[e.path] || capitalizeFirstLetter(e.path);
            let message = e.message.replace(`Path \`${e.path}\` is `, '');
            message = message.replace(`\`${e.path}\` `, '');
            return { label, message };
          })
        : [];

      if (errors.length > 1) {
        const labels = errors.map((e) => e.label.toLowerCase());
        return `${labels.slice(0, -1).join(', ')} and ${labels.slice(-1)} are ${errors[0].message}.`;
      } else {
        return `${errors[0].label} is ${errors[0].message}`;
      }
    }

    case 'DisconnectedError':
      console.error('Disconnected from database:', error);
      return `Database connection lost: ${error.message}`;

    case 'MongoError':
      console.error('MongoDB Error:', error);
      return `An error occurred with MongoDB: ${error.message}`;

    default:
      console.error('Unknown database error:', error);
      return `An unknown error occurred: ${error.message}`;
  }
};


export function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
