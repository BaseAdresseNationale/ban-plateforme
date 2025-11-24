import positionTypeDictionary from './position-type-dictionary.json' with { type: 'json' };

const positionTypeConverter = (data: any, langFrom: string, langTo: string) => {
  const dataMemorized = data.reduce((acc: any, val: any) => {
    return {
      ...acc,
      [val[langFrom]]: val[langTo],
    };
  }, {});

  return (key: string) => dataMemorized[key];
};

const convertBalPositionTypeToBanPositionType = positionTypeConverter(
  positionTypeDictionary,
  'fra',
  'eng'
);

export default convertBalPositionTypeToBanPositionType;
